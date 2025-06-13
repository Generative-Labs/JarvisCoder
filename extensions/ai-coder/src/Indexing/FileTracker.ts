/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { minimatch } from 'minimatch';
import * as vscode from 'vscode';

import { SOURCE_FILE_PATTERNS, EXCLUDED_DIRECTORIES } from './filePatterns';
import { GitignoreHandler } from './GitignoreHandler';
import { FileMetadataStore } from './store';
import { logger } from '../utils/logger';

/**
 * Represents metadata for a tracked file
 */
export interface FileMetadata {
	/** Absolute filesystem path to the tracked file */
	path: string;
	/** MD5 hash of file contents for change detection */
	md5Hash: string;
	/** Last modified timestamp in milliseconds since epoch */
	lastModified: number;
	/** Optional timestamp of last sync with backend */
	lastSynced?: number;
}

/**
 * Result of file change detection
 */
interface FileChangeResult {
	changed: boolean;
	metadata?: FileMetadata;
	error?: Error;
}

/**
 * FileTracker maintains MD5 hashes of workspace files and tracks changes.
 * This is an internal implementation detail - use CodeIndexing class externally.
 */
export class FileTracker implements vscode.Disposable {
	private readonly fileHashes = new Map<string, FileMetadata>();
	private readonly disposables: vscode.Disposable[] = [];
	private readonly _onFileChanged = new vscode.EventEmitter<FileMetadata[]>();
	private readonly pendingChecks = new Map<string, NodeJS.Timeout>();
	private readonly processingFiles = new Set<string>();
	private readonly changedFiles = new Map<string, FileMetadata>();
	private readonly gitignoreHandler: GitignoreHandler;
	private isInitialized = false;

	// Constants
	private static readonly DEBOUNCE_DELAY = 1000; // ms
	private static readonly BATCH_SIZE = 50;
	private static readonly MTIME_TOLERANCE = 1000; // 1 second tolerance for file system timing

	/** Event emitted when files have changed */
	public readonly onFileChanged: vscode.Event<FileMetadata[]> = this._onFileChanged.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.gitignoreHandler = new GitignoreHandler();
	}

	/**
	 * Initialize the FileTracker instance
	 * @throws {Error} If initialization fails
	 */
	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Initialize gitignore handler first
			await this.gitignoreHandler.initialize();

			// Load stored metadata first
			await this.loadStoredMetadata();

			// Get workspace folders
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				logger.warn('No workspace folders found');
				return;
			}

			// Check each workspace's last sync time
			for (const folder of workspaceFolders) {
				const lastSyncTime = await FileMetadataStore.getWorkspaceLastSyncTime(folder.name);
				logger.info(`Workspace ${folder.name} last sync time: ${new Date(lastSyncTime).toISOString()}`);
			}

			// Only index files that haven't been synced or have been modified since last sync
			await this.indexWorkspace();
			this.registerFileWatchers();
			this.isInitialized = true;
			logger.info('FileTracker initialized successfully');
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error('Failed to initialize FileTracker', errorObj);
			throw errorObj;
		}
	}

	/**
	 * Load stored metadata from the database
	 */
	private async loadStoredMetadata(): Promise<void> {
		try {
			logger.info('Loading file metadata from database...');
			const storedMetadata = await FileMetadataStore.getAllFileMetadata();

			// Initialize the file hashes map with stored metadata
			for (const metadata of storedMetadata) {
				this.fileHashes.set(metadata.path, metadata);
			}

			logger.info(`Loaded ${storedMetadata.length} files from database`);
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error('Failed to load stored metadata', errorObj);
			throw errorObj;
		}
	}

	/**
	 * Register file system watchers to track changes more efficiently
	 */
	private registerFileWatchers(): void {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		// Watch for text document changes
		const textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			const document = event.document;
			const filePath = document.uri.fsPath;
			if (!this.shouldSkipFile(filePath)) {
				logger.debug(`Document changed: ${filePath}`);

				// Schedule a check for this file
				this.scheduleFileCheck(filePath);
			}
		});

		// Watch for file saves
		const textDocumentSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
			const filePath = document.uri.fsPath;
			if (!this.shouldSkipFile(filePath)) {
				logger.debug(`Document saved: ${filePath}`);

				// Clear any pending checks
				const existingTimeout = this.pendingChecks.get(filePath);
				if (existingTimeout) {
					clearTimeout(existingTimeout);
					this.pendingChecks.delete(filePath);
				}

				// Remove from processing files
				this.processingFiles.delete(filePath);

				// Check the file immediately after save
				try {
					const result = await this.checkFile(document.uri);
					if (result.changed && result.metadata) {
						logger.debug(
							`File changed after save: ${filePath}, metadata stored: ${this.changedFiles.has(filePath)}`,
						);
						this.changedFiles.set(filePath, result.metadata); // Ensure metadata is stored
						this._onFileChanged.fire([result.metadata]);
					}
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					logger.error(`Error checking file after save ${filePath}`, error);
				}
			}
		});

		// Watch for file system changes
		for (const folder of workspaceFolders) {
			const fileWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(folder, '**/*'),
				false,
				false,
				false,
			);

			fileWatcher.onDidCreate((uri) => {
				if (!this.shouldSkipFile(uri.fsPath)) {
					this.scheduleFileCheck(uri.fsPath);
				}
			});

			fileWatcher.onDidChange((uri) => {
				if (!this.shouldSkipFile(uri.fsPath)) {
					this.scheduleFileCheck(uri.fsPath);
				}
			});

			fileWatcher.onDidDelete((uri) => {
				if (!this.shouldSkipFile(uri.fsPath)) {
					this.handleFileDelete(uri.fsPath);
				}
			});

			this.disposables.push(fileWatcher);
		}

		this.disposables.push(textDocumentChangeDisposable);
		this.disposables.push(textDocumentSaveDisposable);
	}

	private async scheduleFileCheck(filePath: string): Promise<void> {
		// Clear any existing timeout
		const existingTimeout = this.pendingChecks.get(filePath);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Set new timeout
		const timeout = setTimeout(async () => {
			this.pendingChecks.delete(filePath);
			if (!this.processingFiles.has(filePath)) {
				try {
					const uri = vscode.Uri.file(filePath);
					const result = await this.checkFile(uri);
					if (result.changed && result.metadata) {
						logger.debug(`File changed after timeout: ${filePath}`);
						this.changedFiles.set(filePath, result.metadata); // Store metadata directly
						this._onFileChanged.fire([result.metadata]);
					}
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					logger.error(`Error checking file ${filePath}`, error);
				}
			}
		}, FileTracker.DEBOUNCE_DELAY);

		this.pendingChecks.set(filePath, timeout);
	}

	/**
	 * Index all files in the workspace and calculate their MD5 hashes
	 */
	private async indexWorkspace(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		try {
			for (const folder of workspaceFolders) {
				for (const patternStr of SOURCE_FILE_PATTERNS) {
					const pattern = new vscode.RelativePattern(folder, patternStr);
					const excludePattern = new vscode.RelativePattern(
						folder,
						`{${EXCLUDED_DIRECTORIES.join(',')}}`,
					);
					const files = await vscode.workspace.findFiles(pattern, excludePattern);

					for (let i = 0; i < files.length; i += FileTracker.BATCH_SIZE) {
						const batch = files.slice(i, i + FileTracker.BATCH_SIZE);
						await Promise.all(batch.map((file) => this.checkFile(file)));
					}
				}
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error('Error indexing workspace', error);
			throw error;
		}
	}

	private async checkFile(uri: vscode.Uri): Promise<FileChangeResult> {
		const filePath = uri.fsPath;

		if (this.processingFiles.has(filePath) || this.shouldSkipFile(filePath)) {
			// logger.debug(`Skipping file ${filePath} (processing: ${this.processingFiles.has(filePath)}, shouldSkip: ${this.shouldSkipFile(filePath)})`);
			return { changed: false };
		}

		this.processingFiles.add(filePath);

		try {
			const [content, stats] = await Promise.all([
				this.readFileContent(uri),
				fs.promises.stat(filePath),
			]);

			const currentHash = this.calculateMD5(content);
			const currentMtime = stats.mtimeMs;
			const existingMetadata = this.fileHashes.get(filePath);
			const workspaceFolder = this.getWorkspaceFolder(filePath);

			// Get workspace's last sync time
			const workspaceLastSync = workspaceFolder
				? await FileMetadataStore.getWorkspaceLastSyncTime(workspaceFolder)
				: 0;

			// Check if file has actually changed
			const hasChanged =
				!existingMetadata ||
				currentHash !== existingMetadata.md5Hash ||
				Math.abs(currentMtime - existingMetadata.lastModified) > FileTracker.MTIME_TOLERANCE;

			// Only mark for sync if:
			// 1. File has changed AND
			// 2. Either:
			//    a. File has never been synced (no lastSynced timestamp)
			//    b. File was modified after last sync
			//    c. File was modified after workspace's last sync
			const needsSync =
				hasChanged &&
				(!existingMetadata?.lastSynced ||
					existingMetadata.lastSynced < currentMtime ||
					workspaceLastSync < currentMtime);

			if (hasChanged) {
				logger.debug(`File changed: ${filePath} (needsSync: ${needsSync})`);
				const metadata: FileMetadata = {
					path: filePath,
					md5Hash: currentHash,
					lastModified: currentMtime,
					lastSynced: existingMetadata?.lastSynced, // Preserve existing lastSynced timestamp
				};

				await this.updateFileMetadata(metadata);

				// Only add to changedFiles if it needs sync
				if (needsSync) {
					this.changedFiles.set(filePath, metadata);
					logger.debug(`Added ${filePath} to sync queue`);
				}

				return { changed: needsSync, metadata: needsSync ? metadata : undefined };
			}

			return { changed: false };
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error(`Error checking file ${filePath}`, errorObj);
			return { changed: false, error: errorObj };
		} finally {
			this.processingFiles.delete(filePath);
		}
	}

	private async readFileContent(uri: vscode.Uri): Promise<string> {
		const document = await vscode.workspace.openTextDocument(uri);
		return document.getText();
	}

	private async updateFileMetadata(metadata: FileMetadata): Promise<void> {
		this.fileHashes.set(metadata.path, metadata);
		this.changedFiles.set(metadata.path, metadata);
		const workspaceFolder = this.getWorkspaceFolder(metadata.path);
		await FileMetadataStore.saveFileMetadata(metadata, workspaceFolder);
		logger.debug(`Updated metadata for ${metadata.path} in all stores`);
	}

	private async handleFileDelete(filePath: string): Promise<void> {
		try {
			// Remove from in-memory map
			this.fileHashes.delete(filePath);
			this.changedFiles.delete(filePath); // Remove from changed files map

			// Remove from database
			const workspaceFolder = this.getWorkspaceFolder(filePath);
			await FileMetadataStore.deleteFileMetadata(filePath, workspaceFolder);

			logger.debug(`Removed file: ${filePath}`);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error(`Error handling file delete for ${filePath}`, error);
		}
	}

	private shouldIgnoreFiles(filePath: string): boolean {
		// Common files and directories that should always be ignored
		const ignorePatterns = ['.git', '.vscode', '.idea', '.DS_Store'];
		const fileName = path.basename(filePath);

		return ignorePatterns.some((pattern) => fileName === pattern || filePath.endsWith(pattern));
	}

	/**
	 * Check if a file should be skipped based on its path
	 * @param filePath The path of the file to check
	 * @returns True if the file should be skipped
	 */
	private shouldSkipFile(filePath: string): boolean {
		// Skip directories
		try {
			const stat = fs.statSync(filePath);
			if (stat.isDirectory()) {
				return true;
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.debug(`Skipping file ${filePath} due to error: ${error.message}`);
			return true;
		}

		// Check gitignore patterns first (most important)
		if (this.gitignoreHandler.isIgnored(filePath)) {
			logger.debug(`File ${filePath} ignored by .gitignore`);
			return true;
		}

		// Check common ignore patterns
		if (this.shouldIgnoreFiles(filePath)) {
			return true;
		}

		// Skip files in excluded directories
		for (const excludePattern of EXCLUDED_DIRECTORIES) {
			if (minimatch(filePath, excludePattern)) {
				return true;
			}
		}

		// Skip files that don't match source patterns
		return !SOURCE_FILE_PATTERNS.some((pattern) => minimatch(filePath, pattern, { matchBase: true }));
	}

	/**
	 * Calculate MD5 hash for a string
	 */
	private calculateMD5(content: string): string {
		try {
			return crypto.createHash('md5').update(content).digest('hex');
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error('Error calculating MD5 hash', error);
			throw error;
		}
	}

	/**
	 * Get the path relative to the workspace
	 * @param absolutePath The absolute path of the file
	 * @returns The relative path
	 */
	public getRelativePath(absolutePath: string): string {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return absolutePath;
		}

		for (const folder of workspaceFolders) {
			const folderPath = folder.uri.fsPath;
			if (absolutePath.startsWith(folderPath)) {
				return absolutePath.substring(folderPath.length + 1);
			}
		}

		return absolutePath;
	}

	/**
	 * Get the workspace folder for a file
	 * @param filePath The path of the file
	 * @returns The workspace folder name
	 */
	private getWorkspaceFolder(filePath: string): string {
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				return '';
			}

			for (const folder of workspaceFolders) {
				if (filePath.startsWith(folder.uri.fsPath)) {
					return folder.name;
				}
			}

			return '';
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error(`Error getting workspace folder for ${filePath}`, error);
			return '';
		}
	}

	/**
	 * Check for changes in all tracked files
	 * @returns Array of changed file metadata that need sync
	 */
	public async checkForChanges(): Promise<FileMetadata[]> {
		try {
			// Get all files that need sync
			const filesToSync = Array.from(this.changedFiles.values()).filter((metadata) => {
				const existingMetadata = this.fileHashes.get(metadata.path);
				// Double check if file still needs sync (might have been synced by another process)
				return (
					!existingMetadata?.lastSynced ||
					existingMetadata.lastSynced < metadata.lastModified ||
					existingMetadata.md5Hash !== metadata.md5Hash
				);
			});

			if (filesToSync.length > 0) {
				logger.debug(
					`Found ${filesToSync.length} files that need sync: ${filesToSync.map((f) => f.path).join(', ')}`,
				);
				// Only clear the changedFiles map after we've processed the files
				this.changedFiles.clear();
			} else {
				logger.debug('No files need sync in this check');
			}

			return filesToSync;
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error('Error checking for file changes', errorObj);
			return [];
		}
	}

	/**
	 * Dispose of all resources
	 */
	public dispose(): void {
		try {
			// Clear pending checks
			for (const timeout of this.pendingChecks.values()) {
				clearTimeout(timeout);
			}
			this.pendingChecks.clear();

			// Dispose gitignore handler
			this.gitignoreHandler.dispose();

			// Dispose all disposables
			for (const disposable of this.disposables) {
				disposable.dispose();
			}

			// Clear state
			this.fileHashes.clear();
			this.processingFiles.clear();
			this.changedFiles.clear();
			this.isInitialized = false;
			this._onFileChanged.dispose();

			logger.debug('FileTracker disposed successfully');
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error('Error disposing FileTracker', errorObj);
		}
	}

	/**
	 * Get count of tracked files
	 */
	public getTrackedFilesCount(): number {
		return this.fileHashes.size;
	}

	/**
	 * Get metadata for all tracked files
	 */
	public async getAllTrackedFiles(): Promise<FileMetadata[]> {
		return Array.from(this.fileHashes.values());
	}

	/**
	 * Update last synced timestamp for a file
	 * @param filePath - Path of the file to update
	 */
	public async updateLastSynced(filePath: string): Promise<void> {
		try {
			const metadata = this.fileHashes.get(filePath);
			if (!metadata) {
				logger.warn(`Cannot update last synced - file not tracked: ${filePath}`);
				return;
			}

			const workspaceFolder = this.getWorkspaceFolder(filePath);
			if (!workspaceFolder) {
				logger.warn(`Cannot update last synced - no workspace folder found for: ${filePath}`);
				return;
			}

			const syncTime = Date.now();
			const updatedMetadata = {
				...metadata,
				lastSynced: syncTime,
			};

			// Update both file metadata and workspace sync time
			this.fileHashes.set(filePath, updatedMetadata);
			await FileMetadataStore.saveFileMetadata(updatedMetadata, workspaceFolder);

			logger.debug(`Updated sync timestamps for ${filePath} and workspace ${workspaceFolder}`);
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			logger.error(`Error updating sync timestamps for ${filePath}`, errorObj);
		}
	}
}
