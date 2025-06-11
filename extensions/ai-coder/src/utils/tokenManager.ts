/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { logger } from './logger';
import { refreshTokenAction } from '../services/apiServices';
import { TokenInfo } from '../types/auth';

/**
 * Manages authentication tokens including storage, retrieval, and refresh
 * Uses VS Code's SecretStorage API for secure token storage
 */
class TokenManager {
	private static instance: TokenManager;
	private tokenInfo: TokenInfo | null = null;
	private refreshPromise: Promise<void> | null = null;
	private secretStorage: vscode.SecretStorage | null = null;

	// Secret storage keys
	private readonly TOKEN_KEY = 'ai-training-extension.token';
	private readonly REFRESH_TOKEN_KEY = 'ai-training-extension.refreshToken';

	/**
	 * Private constructor to enforce singleton pattern
	 */
	private constructor() {
		// SecretStorage will be initialized via setSecretStorage method
	}

	/**
	 * Gets the singleton instance of TokenManager
	 * @returns The singleton instance
	 */
	public static getInstance(): TokenManager {
		if (!TokenManager.instance) {
			TokenManager.instance = new TokenManager();
		}
		return TokenManager.instance;
	}

	/**
	 * Sets the secret storage from VS Code extension context
	 * @param storage - The VS Code secret storage
	 */
	public setSecretStorage(storage: vscode.SecretStorage): void {
		this.secretStorage = storage;
	}

	/**
	 * Sets the token information
	 * @param token - The access token
	 * @param refreshToken - The refresh token
	 * @param expiresIn - The expiration time in seconds
	 */
	public async setTokenInfo(token: string, refreshToken: string, expiresIn: number): Promise<void> {
		this.tokenInfo = {
			token,
			refreshToken,
			expiresAt: expiresIn,
		};

		if (this.secretStorage) {
			await this.secretStorage.store(this.TOKEN_KEY, token);
			await this.secretStorage.store(this.REFRESH_TOKEN_KEY, refreshToken);
		} else {
			logger.warn('SecretStorage not initialized, tokens not securely stored');
		}
	}

	/**
	 * Gets the current access token
	 * @returns The current access token or null if not available
	 */
	public async getToken(): Promise<string | null> {
		if (this.tokenInfo?.token) {
			return this.tokenInfo.token;
		}

		if (this.secretStorage) {
			return (await this.secretStorage.get(this.TOKEN_KEY)) || null;
		}

		return null;
	}

	/**
	 * Gets the current refresh token
	 * @returns The current refresh token or null if not available
	 */
	public async getRefreshToken(): Promise<string | null> {
		if (this.tokenInfo?.refreshToken) {
			return this.tokenInfo.refreshToken;
		}

		if (this.secretStorage) {
			return (await this.secretStorage.get(this.REFRESH_TOKEN_KEY)) || null;
		}

		return null;
	}

	/**
	 * Checks if the token is expiring soon
	 * @param thresholdSeconds - The threshold in seconds to consider as "soon"
	 * @returns True if the token is expiring soon or not set
	 */
	public isTokenExpiringSoon(thresholdSeconds: number = 300): boolean {
		if (!this.tokenInfo) {
			return true;
		}
		return Date.now() + thresholdSeconds * 1000 >= this.tokenInfo.expiresAt;
	}

	/**
	 * Checks if the token is expired
	 * @returns True if the token is expired or not set
	 */
	public isTokenExpired(): boolean {
		if (!this.tokenInfo) {
			return true;
		}
		return Date.now() >= this.tokenInfo.expiresAt;
	}

	/**
	 * Refreshes the token if needed
	 * @param onNewTokenInfo - Callback when a new token is obtained
	 * @param hardRefresh - Whether to force a hard refresh of the token
	 * @returns The current or new token
	 * @throws {Error} If the refresh token is expired or invalid
	 */
	public async refreshTokenIfNeeded(
		onNewTokenInfo?: (tokenInfo: { token: string; refreshToken: string; expiresAt: number }) => void,
		hardRefresh?: boolean,
	): Promise<string | null> {
		// If already refreshing, wait for the current refresh to complete
		if (this.refreshPromise) {
			await this.refreshPromise;
			return await this.getToken();
		}

		// If token is not expiring soon, return current token
		if (!this.isTokenExpiringSoon() && !hardRefresh) {
			return await this.getToken();
		}

		const refreshToken = await this.getRefreshToken();
		if (!refreshToken) {
			throw new Error('refresh_token_expired');
		}

		// Create new refresh promise
		this.refreshPromise = (async (): Promise<void> => {
			try {
				const result = await refreshTokenAction(refreshToken);
				if (result.success && result.data?.access_token) {
					const expiresAt = Date.now() + result.data.expires_in * 1000;
					this.setTokenInfo(result.data.access_token, result.data.refresh_token, expiresAt);
					if (onNewTokenInfo) {
						onNewTokenInfo({
							token: result.data.access_token,
							refreshToken: result.data.refresh_token,
							expiresAt,
						});
					}
				} else {
					this.clearTokens();
					throw new Error('refresh_token_expired');
				}
			} catch (_error) {
				this.clearTokens();
				throw new Error('refresh_token_expired');
			} finally {
				this.refreshPromise = null;
			}
		})();

		await this.refreshPromise;
		return await this.getToken();
	}
	/**
	 * Clears all stored tokens
	 */
	public async clearTokens(): Promise<void> {
		this.tokenInfo = null;

		if (this.secretStorage) {
			await this.secretStorage.delete(this.TOKEN_KEY);
			await this.secretStorage.delete(this.REFRESH_TOKEN_KEY);
		}
	}
}

export const tokenManager = TokenManager.getInstance();
