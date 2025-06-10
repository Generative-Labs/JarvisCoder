import * as vscode from 'vscode';

import { CodeFile, CodeFileContext, ImportResolver } from './codeContext';
import { FileTracker, FileMetadata } from './FileTracker';
import { AuthStateService } from '../providers/services/authStateService';
import { CodeUploadService } from '../services/codeUploadService';
import { detectLanguageByFilePath } from '../utils/codeDetector';
import { logger } from '../utils/logger';

/**
 * CodeIndexing is the main public API class for code indexing functionality.
 * This is the only class that external code should interact with - other classes
 * like FileTracker and ImportResolver are implementation details.
 *
 * Responsibilities:
 * - Managing file tracking and indexing
 * - Syncing code with the backend
 * - Providing code context for LLM interactions
 */
export class CodeIndexing implements vscode.Disposable {
  private fileTracker: FileTracker;
  private disposables: vscode.Disposable[] = [];
  private static instance: CodeIndexing | null = null;
  private backgroundSyncInterval: NodeJS.Timeout | undefined;
  private readonly BACKGROUND_SYNC_DEBOUNCE = 3000; // ms
  private readonly SYNC_RETRY_DELAY = 5000; // ms
  private readonly MAX_SYNC_RETRIES = 3;
  private isSyncing = false;
  private lastSessionId: string | undefined;
  private syncRetryCount = 0;
  private pendingSyncTimeout: NodeJS.Timeout | undefined;

  private _authStateService: AuthStateService;

  /**
   * Get the singleton instance of CodeIndexing
   * @param {vscode.ExtensionContext} context The VS Code extension context
   * @returns {CodeIndexing} The CodeIndexing instance
   */
  public static getInstance(context: vscode.ExtensionContext): CodeIndexing {
    if (!this.instance) {
      this.instance = new CodeIndexing(context);
    }
    return this.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   * @param {vscode.ExtensionContext} context The VS Code extension context
   */
  private constructor(private context: vscode.ExtensionContext) {
    this.fileTracker = new FileTracker(context);
    this._authStateService = AuthStateService.getInstance(context);

    this.initialize();

    this.startBackgroundSync();
  }

  /**
   * Initialize the CodeIndexing instance
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize the FileTracker instance
      await this.fileTracker.initialize();
      // Register status bar item to show indexing status
      logger.info('CodeIndexing initialized successfully');
    } catch (error) {
      logger.error('Error initializing CodeIndexing:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the number of tracked files
   * @returns {number} The number of tracked files
   */
  public getTrackedFilesCount(): number {
    return this.fileTracker.getTrackedFilesCount();
  }

  /**
   * Get all tracked files
   * @returns {Promise<FileMetadata[]>} Array of file metadata
   */
  public async getAllTrackedFiles(): Promise<FileMetadata[]> {
    return this.fileTracker.getAllTrackedFiles();
  }


  /**
   * Start background sync for changed files
   */
  private startBackgroundSync(): void {
    this.backgroundSyncInterval = setInterval(() => {
      if (this.isSyncing || !this.lastSessionId) {
        logger.debug(`Skipping background sync: isSyncing = ${this.isSyncing}, lastSessionId = ${this.lastSessionId}`);
        return;
      }
      this.syncChangedFilesInBackground("startBackgroundSync", this.lastSessionId);
    }, this.BACKGROUND_SYNC_DEBOUNCE);
  }

  /**
   * Stop background sync
   */
  private stopBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = undefined;
    }
  }

  /**
   * Set the current session ID for background sync
   * @param {string} sessionId - The session ID to set for background syncing
   * @returns {void}
   */
  public setSessionId(sessionId: string): void {
    this.lastSessionId = sessionId;
  }

  /**
   * Sync files for a specific session
   * @param {string} sessionId - The session ID to sync files for
   * @returns {Promise<void>}
   */
  public async syncFilesForSession(triggerFrom: string, sessionId: string): Promise<void> {
    await this.syncChangedFilesInBackground(triggerFrom, sessionId);
  }


  /**
   * Background sync: upload changed files only with retry mechanism
   */
  private async syncChangedFilesInBackground(triggerFrom: string, sessionId: string): Promise<void> {
    if (this.isSyncing) {
      logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    try {
      const changedFiles = await this.fileTracker.checkForChanges();
      logger.debug(`🔍 checkForChanges changedFiles${changedFiles}`);
      logger.debug(`[Background Sync] Found ${changedFiles.length} files that need sync from ${triggerFrom}`);

      if (changedFiles.length === 0) {
        this.syncRetryCount = 0;
        return;
      }

      const filePaths = changedFiles.map(f => f.path);
      const uploadService = CodeUploadService.getInstance();
      const tokenInfo = await this._authStateService.getTokenInfo();
      if (!tokenInfo) {
        throw new Error('Token info not found');
      }

      // Record sync start time for consistent timestamp
      const syncStartTime = Date.now();
      const result = await uploadService.uploadFiles(sessionId, tokenInfo, filePaths);
      logger.debug(`🔍 upload result${result}`);

      if (result.success) {
        // Use sync start time as lastSynced timestamp for all files
        // This ensures consistent timestamps across the batch and prevents time drift issues
        for (const file of changedFiles) {
          await this.fileTracker.updateLastSynced(file.path);
        }
        logger.info(`[Background Sync] Successfully uploaded ${changedFiles.length} files in ${Date.now() - syncStartTime}ms`);
        this.syncRetryCount = 0;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      logger.error('[Background Sync] Error:', error instanceof Error ? error : new Error(String(error)));

      // Only retry on network, server, or timeout errors
      const shouldRetry = error instanceof Error &&
        (error.message.includes('network') ||
          error.message.includes('server') ||
          error.message.includes('timeout'));

      if (shouldRetry && this.syncRetryCount < this.MAX_SYNC_RETRIES) {
        this.syncRetryCount++;
        logger.info(`[Background Sync] Retrying sync (attempt ${this.syncRetryCount}/${this.MAX_SYNC_RETRIES})...`);
        setTimeout(() => {
          this.syncChangedFilesInBackground(triggerFrom, sessionId);
        }, this.SYNC_RETRY_DELAY);
      } else {
        if (!shouldRetry) {
          logger.warn('[Background Sync] Not retrying due to non-retryable error');
        } else {
          logger.error('[Background Sync] Max retry attempts reached, giving up');
        }
        this.syncRetryCount = 0;
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get code context for LLM processing
   * @param {vscode.Uri} primaryFileUri - URI of the primary file
   * @param {vscode.Range} [selection] - Optional selection range in the primary file
   * @param {boolean} [resolveImports=true] - Whether to resolve and include imported files
   * @param {number} [maxImportDepth=1] - Maximum depth for resolving imports (1 = direct imports only)
   * @returns {Promise<CodeFileContext | null>} Code context for LLM or null if failed
   */
  public async getCodeContextForLLM(
    primaryFileUri: vscode.Uri,
    selection?: vscode.Range,
    resolveImports: boolean = true,
    maxImportDepth: number = 1
  ): Promise<CodeFileContext | null> {
    try {
      // Read the primary file
      const document = await vscode.workspace.openTextDocument(primaryFileUri);
      const primaryFilePath = primaryFileUri.fsPath;
      const workspaceFolder = this.getWorkspaceFolder(primaryFilePath);

      if (!workspaceFolder) {
        logger.warn(`File ${primaryFilePath} is not in a workspace folder`);
        return null;
      }

      const relativePath = this.getRelativePath(primaryFilePath, workspaceFolder.uri.fsPath);
      const languageId = document.languageId || detectLanguageByFilePath(primaryFilePath);

      const primaryFile: CodeFile = {
        path: primaryFilePath,
        relativePath,
        content: document.getText(),
        languageId
      };

      const context: CodeFileContext = {
        primaryFile,
        importedFiles: [],
        selection
      };

      // Resolve imports if requested
      if (resolveImports && maxImportDepth > 0) {
        await this.resolveImportsRecursively(
          context,
          primaryFile,
          workspaceFolder,
          new Set<string>([primaryFilePath]), // Track processed files to avoid cycles
          maxImportDepth
        );
      }

      return context;
    } catch (error) {
      logger.error(`Error getting code context for LLM from ${primaryFileUri.fsPath}:`,
        error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Recursively resolve imports for a file
   * @param {CodeFileContext} context - Context to add imported files to
   * @param {CodeFile} file - File to resolve imports for
   * @param {vscode.WorkspaceFolder} workspaceFolder - Workspace folder containing the file
   * @param {Set<string>} processedFiles - Set of already processed file paths
   * @param {number} depthRemaining - Remaining depth for recursive resolution
   * @returns {Promise<void>}
   */
  private async resolveImportsRecursively(
    context: CodeFileContext,
    file: CodeFile,
    workspaceFolder: vscode.WorkspaceFolder,
    processedFiles: Set<string>,
    depthRemaining: number
  ): Promise<void> {
    if (depthRemaining <= 0) { return; }

    try {
      // Resolve imports for this file
      const importPaths = await ImportResolver.resolveImports(
        file.path,
        file.content,
        file.languageId
      );

      // Process each imported file
      for (const importPath of importPaths) {
        // Skip if already processed
        if (processedFiles.has(importPath)) { continue; }
        processedFiles.add(importPath);

        try {
          // Read the imported file
          const importUri = vscode.Uri.file(importPath);
          const importDoc = await vscode.workspace.openTextDocument(importUri);
          const relativePath = this.getRelativePath(importPath, workspaceFolder.uri.fsPath);
          const languageId = importDoc.languageId || detectLanguageByFilePath(importPath);

          const importedFile: CodeFile = {
            path: importPath,
            relativePath,
            content: importDoc.getText(),
            languageId
          };

          // Add to context
          context.importedFiles.push(importedFile);

          // Recursively resolve imports for this file
          if (depthRemaining > 1) {
            await this.resolveImportsRecursively(
              context,
              importedFile,
              workspaceFolder,
              processedFiles,
              depthRemaining - 1
            );
          }
        } catch (importError) {
          logger.warn(`Error processing import ${importPath}: ${importError instanceof Error ? importError.message : String(importError)}`);
          // Continue with other imports
        }
      }
    } catch (error) {
      logger.error(`Error resolving imports for ${file.path}:`,
        error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the workspace folder containing a file
   * @param {string} filePath - Absolute path to the file
   * @returns {vscode.WorkspaceFolder | undefined} Workspace folder or undefined if not found
   */
  private getWorkspaceFolder(filePath: string): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return undefined; }

    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      if (filePath.startsWith(folderPath)) {
        return folder;
      }
    }

    return undefined;
  }

  /**
   * Get the path relative to a base directory
   * @param {string} absolutePath - Absolute path
   * @param {string} baseDir - Base directory
   * @returns {string} Relative path
   */
  private getRelativePath(absolutePath: string, baseDir: string): string {
    if (absolutePath.startsWith(baseDir)) {
      // Remove base directory and leading slash
      const relativePath = absolutePath.substring(baseDir.length);
      return relativePath.startsWith('/') || relativePath.startsWith('\\')
        ? relativePath.substring(1)
        : relativePath;
    }

    return absolutePath;
  }

  /**
   * Get code context for the active editor
   * @param {boolean} [resolveImports=true] - Whether to resolve imports
   * @param {number} [maxImportDepth=1] - Maximum depth for import resolution
   * @returns {Promise<CodeFileContext | null>} Code context for the active editor
   */
  public async getCodeContextForActiveEditor(
    resolveImports: boolean = true,
    maxImportDepth: number = 1
  ): Promise<CodeFileContext | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    return this.getCodeContextForLLM(
      editor.document.uri,
      editor.selection.isEmpty ? undefined : editor.selection,
      resolveImports,
      maxImportDepth
    );
  }

  /**
   * Get code context for a specific file
   * @param {string} filePath - Absolute path to the file
   * @param {boolean} [resolveImports=true] - Whether to resolve imports
   * @param {number} [maxImportDepth=1] - Maximum depth for import resolution
   * @returns {Promise<CodeFileContext | null>} Code context for the file
   */
  public async getCodeContextForFile(
    filePath: string,
    resolveImports: boolean = true,
    maxImportDepth: number = 1
  ): Promise<CodeFileContext | null> {
    return this.getCodeContextForLLM(
      vscode.Uri.file(filePath),
      undefined,
      resolveImports,
      maxImportDepth
    );
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
    }
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }
    this.fileTracker.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables = [];
    CodeIndexing.instance = null;
  }
}