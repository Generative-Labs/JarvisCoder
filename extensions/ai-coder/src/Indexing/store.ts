/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { FileMetadata } from './FileTracker';
import { logger } from '../utils/logger';

/**
 * Interface for the file metadata table in the database
 */
export interface FileMetadataTable extends FileMetadata {
	/**
	 * The workspace folder containing the file
	 */
	workspaceFolder: string;
}

/**
 * Storage keys used for VS Code extension storage
 */
const STORAGE_KEYS = {
	FILE_METADATA_PREFIX: 'fileMetadata',
	WORKSPACE_METADATA_PREFIX: 'workspaceMetadata',
};

/**
 * Current session ID for file metadata
 */
let _currentSessionId: string | null = null;

/**
 * Set the current session ID for file metadata
 * @param sessionId - The session ID to set
 */
export function setSessionId(sessionId: string): void {
	_currentSessionId = sessionId;
	logger.info(`Set session ID for file metadata: ${sessionId}`);
}

/**
 * Get the storage key for file metadata based on workspace folder
 * @param workspaceFolder The workspace folder
 * @returns The storage key
 */
function getStorageKey(workspaceFolder: string): string {
	const workspacePart = workspaceFolder ? `_${encodeURIComponent(workspaceFolder)}` : '';
	return `${STORAGE_KEYS.FILE_METADATA_PREFIX}${workspacePart}`;
}

/**
 * Get the storage key for workspace metadata
 * @param workspaceFolder The workspace folder
 * @returns The storage key
 */
function getWorkspaceStorageKey(workspaceFolder: string): string {
	return `${STORAGE_KEYS.WORKSPACE_METADATA_PREFIX}_${encodeURIComponent(workspaceFolder)}`;
}

/**
 * Extension context for accessing VS Code storage APIs
 */
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Initialize the storage with VS Code extension context
 * @param context The VS Code extension context
 */
export function initializeStorage(context: vscode.ExtensionContext): void {
	extensionContext = context;
	logger.info('VS Code storage initialized for file metadata');
}

/**
 * Class for storing and retrieving file metadata
 */
export class FileMetadataStore {
	/**
	 * Save file metadata to VS Code storage
	 * @param metadata The file metadata to save
	 * @param workspaceFolder The workspace folder containing the file
	 * @returns A promise that resolves when the operation is complete
	 */
	public static async saveFileMetadata(
		metadata: FileMetadata,
		workspaceFolder: string,
	): Promise<void> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		// Get the storage key for this workspace folder
		const storageKey = getStorageKey(workspaceFolder);

		// Get existing metadata for this workspace
		const allMetadata = await this.getAllFileMetadataByKey(storageKey);

		// Find if this file already exists in storage
		const index = allMetadata.findIndex((item) => item.path === metadata.path);

		// Create the new metadata entry
		const newEntry: FileMetadataTable = {
			...metadata,
			workspaceFolder,
		};

		// Update or add the entry
		if (index >= 0) {
			allMetadata[index] = newEntry;
		} else {
			allMetadata.push(newEntry);
		}

		// Save back to storage
		await extensionContext.globalState.update(storageKey, allMetadata);

		// Also update workspace metadata to track last sync time
		const workspaceKey = getWorkspaceStorageKey(workspaceFolder);
		const workspaceMetadata = extensionContext.globalState.get<{ lastSync: number }>(workspaceKey, {
			lastSync: 0,
		});
		workspaceMetadata.lastSync = Date.now();
		await extensionContext.globalState.update(workspaceKey, workspaceMetadata);
	}

	/**
	 * Get file metadata from VS Code storage
	 * @param filePath The path of the file
	 * @returns The file metadata or undefined if not found
	 */
	public static async getFileMetadata(
		filePath: string,
		workspaceFolder: string,
	): Promise<FileMetadataTable | undefined> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		const storageKey = getStorageKey(workspaceFolder);
		const allMetadata = await this.getAllFileMetadataByKey(storageKey);
		return allMetadata.find((item) => item.path === filePath);
	}

	/**
	 * Helper method to get file metadata by specific storage key
	 * @param storageKey The storage key to use
	 * @returns Array of file metadata
	 * @private
	 */
	private static async getAllFileMetadataByKey(storageKey: string): Promise<FileMetadataTable[]> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		return extensionContext.globalState.get<FileMetadataTable[]>(storageKey, []);
	}

	/**
	 * Get all file metadata from VS Code storage across all sessions and workspaces
	 * @returns Array of file metadata
	 */
	public static async getAllFileMetadata(): Promise<FileMetadataTable[]> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		// Get all keys that start with the file metadata prefix
		const allKeys = extensionContext.globalState
			.keys()
			.filter((key) => key.startsWith(STORAGE_KEYS.FILE_METADATA_PREFIX));

		// Combine all metadata from all keys
		const allMetadata: FileMetadataTable[] = [];
		for (const key of allKeys) {
			const metadata = extensionContext.globalState.get<FileMetadataTable[]>(key, []);
			allMetadata.push(...metadata);
		}

		return allMetadata;
	}

	/**
	 * Delete file metadata from VS Code storage
	 * @param filePath The path of the file
	 * @param workspaceFolder The workspace folder containing the file
	 * @returns A promise that resolves when the operation is complete
	 */
	public static async deleteFileMetadata(filePath: string, workspaceFolder: string): Promise<void> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		// Get the storage key for this workspace folder
		const storageKey = getStorageKey(workspaceFolder);

		// Get existing metadata for this workspace and session
		const allMetadata = await this.getAllFileMetadataByKey(storageKey);

		// Filter out the file to delete
		const filteredMetadata = allMetadata.filter((item) => item.path !== filePath);

		// Save back to storage
		if (filteredMetadata.length !== allMetadata.length) {
			await extensionContext.globalState.update(storageKey, filteredMetadata);
		}
	}

	/**
	 * Clear all file metadata from VS Code storage for the current session and workspace
	 * @param workspaceFolder The workspace folder
	 * @returns A promise that resolves when the operation is complete
	 */
	public static async clearFileMetadataForWorkspace(workspaceFolder: string): Promise<void> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		const storageKey = getStorageKey(workspaceFolder);
		await extensionContext.globalState.update(storageKey, []);
	}

	/**
	 * Clear all file metadata from VS Code storage across all sessions and workspaces
	 * @returns A promise that resolves when the operation is complete
	 */
	public static async clearAllFileMetadata(): Promise<void> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		// Get all keys that start with the file metadata prefix
		const allKeys = extensionContext.globalState
			.keys()
			.filter((key) => key.startsWith(STORAGE_KEYS.FILE_METADATA_PREFIX));

		// Clear all metadata for all keys
		for (const key of allKeys) {
			await extensionContext.globalState.update(key, undefined);
		}
	}

	/**
	 * Get all file metadata for a specific workspace folder
	 * @param workspaceFolder The workspace folder
	 * @returns Array of file metadata for the workspace folder
	 */
	public static async getFileMetadataByWorkspace(
		workspaceFolder: string,
	): Promise<FileMetadataTable[]> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		const storageKey = getStorageKey(workspaceFolder);
		return this.getAllFileMetadataByKey(storageKey);
	}

	/**
	 * Check if a file has changed by comparing its current MD5 hash with the stored one
	 * @param filePath The path of the file
	 * @param currentMD5 The current MD5 hash of the file
	 * @param workspaceFolder The workspace folder containing the file
	 * @returns True if the file has changed, false otherwise
	 */
	public static async hasFileChanged(
		filePath: string,
		currentMD5: string,
		workspaceFolder: string,
	): Promise<boolean> {
		const metadata = await this.getFileMetadata(filePath, workspaceFolder);
		if (!metadata) {
			return true; // File not in database, consider it changed
		}
		return metadata.md5Hash !== currentMD5;
	}

	/**
	 * Get the last sync time for a workspace
	 * @param workspaceFolder The workspace folder
	 * @returns The last sync timestamp
	 */
	public static async getWorkspaceLastSyncTime(workspaceFolder: string): Promise<number> {
		if (!extensionContext) {
			throw new Error('Storage not initialized. Call initializeStorage first.');
		}

		const workspaceKey = getWorkspaceStorageKey(workspaceFolder);
		const workspaceMetadata = extensionContext.globalState.get<{ lastSync: number }>(workspaceKey, {
			lastSync: 0,
		});
		return workspaceMetadata.lastSync;
	}
}
