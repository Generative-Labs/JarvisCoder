import * as vscode from 'vscode';

import { API_BASE_URL } from '../configs';
import { TokenInfo } from '../types/auth';
import { detectLanguageByFilePath } from '../utils/codeDetector';
import { logger } from '../utils/logger';
import { fetchWithToken } from '../utils/requestInterceptor';

/**
 * Interface for file data to be uploaded to the backend
 */
export interface CodeFileUpload {
  /**
   * Relative path of the file in the workspace
   */
  path: string;
  /**
   * Source code content of the file
   */
  code: string;
  /**
   * Programming language identifier (e.g., 'typescript', 'python', 'solidity')
   */
  language: string;
}

/**
 * Response interface for file upload operations from the backend API
 */
export interface FileUploadResponse {
  /**
   * Whether the upload operation was successful
   */
  success: boolean;
  /**
   * Optional success message from the server
   */
  message?: string;
  /**
   * Optional error message if the upload failed
   */
  error?: string;
}

/**
 * Service for uploading code files to the backend
 */
export class CodeUploadService {
  private static instance: CodeUploadService | null = null;
  private readonly API_BASE_URL: string;

  /**
   * Get the singleton instance of CodeUploadService
   * @returns {CodeUploadService} The CodeUploadService instance
   */
  public static getInstance(): CodeUploadService {
    if (!this.instance) {
      this.instance = new CodeUploadService();
    }
    return this.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   * Empty because no initialization is needed
   */
  private constructor() {
    this.API_BASE_URL = API_BASE_URL;
  }

  /**
   * Upload files to the backend
   * @param sessionId - The session ID to upload files for
   * @param tokenInfo - The token info for authentication
   * @param filePaths - Array of file paths to upload
   * @returns Promise<FileUploadResponse>
   */
  public async uploadFiles(sessionId: string, tokenInfo: TokenInfo, filePaths: string[]): Promise<FileUploadResponse> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      if (!tokenInfo?.token) {
        throw new Error('Valid token is required');
      }

      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('At least one file path is required');
      }

      const codeFiles: CodeFileUpload[] = [];

      for (const filePath of filePaths) {
        if (typeof filePath !== 'string' || !filePath.trim()) {
          logger.warn(`Skipping invalid file path: ${filePath}`);
          continue;
        }

        try {
          const uri = vscode.Uri.file(filePath);
          const document = await vscode.workspace.openTextDocument(uri);
          const code = document.getText();

          // Skip empty files
          if (!code.trim()) {
            logger.warn(`Skipping empty file: ${filePath}`);
            continue;
          }

          const language = detectLanguageByFilePath(filePath);
          if (!language) {
            logger.warn(`Could not detect language for file: ${filePath}, using plaintext`);
          }

          // Get relative path for the file
          const relativePath = this.getRelativePath(filePath);
          if (!relativePath) {
            logger.warn(`Could not get relative path for file: ${filePath}`);
            continue;
          }

          codeFiles.push({
            path: relativePath,
            code,
            language: language || 'plaintext'
          });
        } catch (error) {
          logger.error(`Error preparing file ${filePath} for upload:`,
            error instanceof Error ? error : new Error(String(error)));
        }
      }

      if (codeFiles.length === 0) {
        logger.warn('No valid files prepared for upload');
        return {
          success: false,
          error: 'No valid files to upload'
        };
      }

      logger.debug(`Preparing to upload ${codeFiles.length} files to backend...`);

      // Call the upload API with JWT authentication
      const response = await fetchWithToken(
        `${this.API_BASE_URL}/index/upload_files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            session_id: sessionId,
            code_files: codeFiles,
          })
        },
        tokenInfo
      );

      // Read response body only once
      const responseData = await response.json();

      if (!response.ok) {
        logger.error('Upload failed:', responseData);
        return {
          success: false,
          error: responseData.error || `HTTP error ${response.status}`
        };
      }

      logger.info(`Successfully uploaded ${codeFiles.length} files to backend`);
      return {
        success: true,
        message: responseData.message || 'Files uploaded successfully'
      };

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Error uploading files:', errorObj);
      return {
        success: false,
        error: errorObj.message
      };
    }
  }

  /**
   * Get the path relative to the workspace
   * @param {string} absolutePath The absolute path of the file
   * @returns {string} The relative path
   */
  private getRelativePath(absolutePath: string): string {
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
}
