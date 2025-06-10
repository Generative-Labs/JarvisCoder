/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import cors from 'cors';
import express from 'express';
import * as vscode from 'vscode';

import { AUTH_URL } from '../../../configs';
import { decrypt } from '../../../utils/crypto';
import { Logger } from '../../../utils/logger';
import { EventMessage, EventResponseMessage } from '../../chatEventMessage';
import { AuthStateService } from '../../services/authStateService';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class AuthHandler implements MessageHandler {
	async handle(data: MessageData, context: MessageContext): Promise<void> {
		const { webview, context: extensionContext } = context;

		switch (data.type) {
			case EventMessage.REFRESH_TOKEN_EXPIRED:
				// REFRESH_TOKEN_EXPIRED: Only handle logout, do not start auth
				if (extensionContext) {
					await AuthHandler.handleLogout(extensionContext, webview);
				}
				break;

			case EventMessage.LOGOUT:
				// LOGOUT: Start auth listener first, then handle logout
				await AuthHandler.startAuthListener(webview, extensionContext);
				if (extensionContext) {
					await AuthHandler.handleLogout(extensionContext, webview);
				}
				break;

			case EventMessage.START_AUTH:
				await AuthHandler.startAuthListener(webview, extensionContext);
				break;
		}
	}

	/**
	 * Handle user logout operation
	 * Static method that can be used without creating an AuthHandler instance
	 */
	static async handleLogout(
		context: vscode.ExtensionContext,
		webview?: vscode.Webview,
	): Promise<void> {
		const authStateService = AuthStateService.getInstance(context);
		await authStateService.clearAllState();

		if (webview) {
			webview.postMessage({
				type: EventResponseMessage.TOKEN_AND_USER_INFO,
				value: {
					tokenInfo: null,
					userInfo: null,
				},
			});
		}
	}

	/**
	 * Start authentication listener
	 * Static method that can be used without creating an AuthHandler instance
	 */
	static async startAuthListener(
		webview?: vscode.Webview,
		context?: vscode.ExtensionContext,
	): Promise<void> {
		vscode.env.openExternal(vscode.Uri.parse(AUTH_URL));
		const port = 54321;
		const app = express();
		app.use(cors());
		app.use(express.json());

		app.post('/receive-code', async (req, res) => {
			const body = req.body;
			if (body?.encryptedData) {
				let decryptRes = '';
				try {
					decryptRes = decrypt(body.encryptedData);
				} catch (error: unknown) {
					const errorMessage = error instanceof Error ? error : new Error(String(error));
					Logger.error('Error decrypting data:', errorMessage);
					vscode.window.showErrorMessage(errorMessage.message || 'Error decrypting data');
					return;
				}
				const decryptResObj = JSON.parse(decryptRes);
				if (!decryptResObj.token) {
					vscode.window.showErrorMessage('Login failed');
					return;
				}

				const userInfo = {
					...decryptResObj.user,
					avatar: `https://cdn.stamp.fyi/avatar/${decryptResObj.user.name}`,
				};
				const tokenInfo = {
					token: decryptResObj.token,
					refreshToken: decryptResObj.refresh_token,
					expiresAt: decryptResObj.tokenPayload.exp * 1000 || 0,
				};

				// Use the passed context, consistent with original code logic
				if (context) {
					const authStateService = AuthStateService.getInstance(context);
					await authStateService.saveUserInfo(userInfo);
					await authStateService.saveTokenInfo(tokenInfo);

					if (webview) {
						webview.postMessage({
							type: EventResponseMessage.TOKEN_AND_USER_INFO,
							value: {
								tokenInfo: tokenInfo,
								userInfo: userInfo,
							},
						});
					}
				}

				vscode.window.showInformationMessage(decryptResObj.message);

				// stop the server after successful login
				if (server) {
					server.close(() => {
						Logger.info('Server stopped after successful login');
					});
				}
			}
			res.send({ status: 'ok' });
		});

		const server = app.listen(port, () => {
			Logger.info(
				`VS Code extension local service is listening at http://localhost:${port}/receive-code`,
			);
		});
	}
}
