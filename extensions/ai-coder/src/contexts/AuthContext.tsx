/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useVSCode } from './VSCodeContext';
import { EventMessage } from '../providers/chatEventMessage';
import { TokenInfo, UserInfo } from '../types/auth';
import { logger } from '../utils/logger';
import { tokenManager } from '../utils/tokenManager';

const TOKEN_EXPIRATION_CHECK_INTERVAL = 60000; // 1 minute

// Ensure vscode API is available

interface AuthContextType {
	userInfo: UserInfo | null;
	setUserInfo: (userInfo: UserInfo | null) => void;
	onTokenExpired: () => void;
	isAuthenticated: boolean;
	tokenInfo: TokenInfo | null;
	setTokenInfo: (tokenInfo: TokenInfo | null) => void;
	onUpdateTokenInfo: (tokenInfo: TokenInfo) => void;
	handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const { vscode } = useVSCode();
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

	// Handle user info expiration
	const onTokenExpired = useCallback(() => {
		setIsAuthenticated(false);
		tokenManager.clearTokens().catch((err) => logger.error('Error clearing tokens:', err));
		vscode.postMessage({ type: EventMessage.REFRESH_TOKEN_EXPIRED });
	}, [vscode]);

	const handleLogout = useCallback(() => {
		setIsAuthenticated(false);
		tokenManager.clearTokens().catch((err) => logger.error('Error clearing tokens:', err));
		vscode.postMessage({ type: EventMessage.LOGOUT });
	}, [vscode]);

	const onUpdateTokenInfo = useCallback(
		(newTokenInfo: { token: string; refreshToken: string; expiresAt: number }) => {
			if (!newTokenInfo) {
				return;
			}
			setTokenInfo(newTokenInfo);
			vscode.postMessage({
				type: EventMessage.SAVE_TOKEN_INFO,
				value: JSON.stringify(newTokenInfo),
			});
		},
		[],
	);

	// Update authentication status when userInfo changes
	useEffect(() => {
		if (tokenInfo) {
			const currentTime = Date.now();
			if (tokenInfo.expiresAt > currentTime) {
				setIsAuthenticated(true);
			} else {
				onTokenExpired();
			}
		} else {
			setIsAuthenticated(false);
		}
	}, [tokenInfo, onTokenExpired]);

	// Periodically check if token is expired
	useEffect(() => {
		if (!onUpdateTokenInfo) {
			return;
		}
		if (!tokenInfo) {
			return;
		}

		let intervalId: NodeJS.Timeout | null = null;
		const check = async () => {
			const cachedToken = await tokenManager.getToken();
			if (!cachedToken) {
				return;
			}

			if (tokenManager.isTokenExpired()) {
				try {
					await tokenManager.refreshTokenIfNeeded(onUpdateTokenInfo);
				} catch (error) {
					onTokenExpired();
				}
				return;
			}
			if (tokenManager.isTokenExpiringSoon()) {
				tokenManager.refreshTokenIfNeeded(onUpdateTokenInfo).catch((error) => {
					onTokenExpired();
				});
				return;
			}
		};

		check();
		intervalId = setInterval(check, TOKEN_EXPIRATION_CHECK_INTERVAL);

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	}, [tokenInfo, onTokenExpired, onUpdateTokenInfo]);

	return (
		<AuthContext.Provider
			value={{
				userInfo,
				setUserInfo,
				onTokenExpired,
				isAuthenticated,
				tokenInfo,
				setTokenInfo,
				onUpdateTokenInfo,
				handleLogout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
