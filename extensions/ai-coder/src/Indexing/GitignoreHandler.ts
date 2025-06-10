import * as fs from 'fs';
import * as path from 'path';

import { minimatch } from 'minimatch';
import * as vscode from 'vscode';

import { logger } from '../utils/logger';

/**
 * Handles .gitignore file parsing and pattern matching
 */
export class GitignoreHandler {
    private gitignorePatterns = new Map<string, string[]>();
    private gitignoreCache = new Map<string, { patterns: string[]; mtime: number }>();
    private readonly disposables: vscode.Disposable[] = [];

    constructor() {
        this.watchGitignoreFiles();
    }

    /**
     * Initialize gitignore patterns for all workspace folders
     */
    public async initialize(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            await this.loadGitignoreForWorkspace(folder.uri.fsPath);
        }
    }

    /**
     * Load gitignore patterns for a specific workspace
     */
    private async loadGitignoreForWorkspace(workspacePath: string): Promise<void> {
        try {
            const gitignorePath = path.join(workspacePath, '.gitignore');

            // Check if .gitignore exists
            if (!fs.existsSync(gitignorePath)) {
                logger.debug(`No .gitignore found in ${workspacePath}`);
                return;
            }

            const stats = await fs.promises.stat(gitignorePath);
            const cached = this.gitignoreCache.get(workspacePath);

            // Use cache if file hasn't changed
            if (cached && cached.mtime === stats.mtimeMs) {
                this.gitignorePatterns.set(workspacePath, cached.patterns);
                return;
            }

            const content = await fs.promises.readFile(gitignorePath, 'utf8');
            const patterns = this.parseGitignoreContent(content);

            // Cache the patterns with mtime
            this.gitignoreCache.set(workspacePath, {
                patterns,
                mtime: stats.mtimeMs
            });

            this.gitignorePatterns.set(workspacePath, patterns);
            logger.debug(`Loaded ${patterns.length} gitignore patterns from ${gitignorePath}`);
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger.error(`Error loading gitignore for ${workspacePath}`, errorObj);
        }
    }

    /**
     * Parse .gitignore file content into patterns
     */
    private parseGitignoreContent(content: string): string[] {
        const patterns: string[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Handle negation patterns (starting with !)
            if (trimmed.startsWith('!')) {
                // For now, we'll treat negation patterns as regular patterns
                // A more sophisticated implementation would handle negation properly
                patterns.push(trimmed.substring(1));
                continue;
            }

            patterns.push(trimmed);
        }

        return patterns;
    }

    /**
     * Check if a file should be ignored based on gitignore patterns
     */
    public isIgnored(filePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }

        // Find the workspace folder for this file
        let workspacePath = '';
        for (const folder of workspaceFolders) {
            if (filePath.startsWith(folder.uri.fsPath)) {
                workspacePath = folder.uri.fsPath;
                break;
            }
        }

        if (!workspacePath) {
            return false;
        }

        const patterns = this.gitignorePatterns.get(workspacePath);
        if (!patterns || patterns.length === 0) {
            return false;
        }

        // Get relative path from workspace root
        const relativePath = path.relative(workspacePath, filePath);

        // Normalize path separators for cross-platform compatibility
        const normalizedPath = relativePath.replace(/\\/g, '/');

        // Check against each pattern
        for (const pattern of patterns) {
            if (this.matchesPattern(normalizedPath, pattern)) {
                logger.debug(`File ${normalizedPath} matches gitignore pattern: ${pattern}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a path matches a gitignore pattern
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Handle directory patterns (ending with /)
        if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1);
            // Check if any part of the path matches the directory pattern
            const pathParts = filePath.split('/');
            for (let i = 0; i < pathParts.length - 1; i++) {
                const dirPath = pathParts.slice(0, i + 1).join('/');
                if (minimatch(dirPath, dirPattern) || minimatch(pathParts[i], dirPattern)) {
                    return true;
                }
            }
            return false;
        }

        // Handle patterns starting with /
        if (pattern.startsWith('/')) {
            const rootPattern = pattern.substring(1);
            // For root patterns, match from the beginning of the path
            return minimatch(filePath, rootPattern) || filePath.startsWith(rootPattern);
        }

        // Handle patterns with path separators
        if (pattern.includes('/')) {
            // Try matching the full path
            if (minimatch(filePath, pattern)) {
                return true;
            }

            // Try matching from any directory level
            const pathParts = filePath.split('/');
            for (let i = 0; i < pathParts.length; i++) {
                const subPath = pathParts.slice(i).join('/');
                if (minimatch(subPath, pattern)) {
                    return true;
                }
            }
            return false;
        }

        // Simple filename patterns
        const filename = path.basename(filePath);
        if (minimatch(filename, pattern)) {
            return true;
        }

        // Check if any directory in the path matches
        const pathParts = filePath.split('/');
        for (const part of pathParts) {
            if (minimatch(part, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Watch for changes to .gitignore files
     */
    private watchGitignoreFiles(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            const gitignorePattern = new vscode.RelativePattern(folder, '.gitignore');
            const watcher = vscode.workspace.createFileSystemWatcher(gitignorePattern);

            watcher.onDidCreate(async () => {
                logger.info(`Gitignore file created in ${folder.uri.fsPath}`);
                await this.loadGitignoreForWorkspace(folder.uri.fsPath);
            });

            watcher.onDidChange(async () => {
                logger.info(`Gitignore file changed in ${folder.uri.fsPath}`);
                await this.loadGitignoreForWorkspace(folder.uri.fsPath);
            });

            watcher.onDidDelete(() => {
                logger.info(`Gitignore file deleted in ${folder.uri.fsPath}`);
                this.gitignorePatterns.delete(folder.uri.fsPath);
                this.gitignoreCache.delete(folder.uri.fsPath);
            });

            this.disposables.push(watcher);
        }
    }

    /**
     * Get all loaded gitignore patterns for debugging
     */
    public getLoadedPatterns(): Map<string, string[]> {
        return new Map(this.gitignorePatterns);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.gitignorePatterns.clear();
        this.gitignoreCache.clear();
    }
} 