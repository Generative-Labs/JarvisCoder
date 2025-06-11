/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { registerCommands } from './core/commands/registerCommands';
import { CodeIndexing } from './Indexing/CodeIndexing';
import { initializeStorage } from './Indexing/store';
import { ChatViewProvider } from './providers/chatViewProvider';
import { initializeTelemetry, getTelemetryManager } from './telemetry';
import { Logger } from './utils/logger';
import { tokenManager } from './utils/tokenManager';

/**
 * Activates the AI Chat extension
 * @param context - The extension context
 * @returns - Extension exports including context
 */
export function activate(context: vscode.ExtensionContext): { context: vscode.ExtensionContext } {
	// Create an output channel for logging
	const outputChannel = vscode.window.createOutputChannel('AI Training Extension');
	Logger.initialize(outputChannel);

	// Initialize storage for file metadata
	initializeStorage(context);

	// Initialize TokenManager with SecretStorage
	tokenManager.setSecretStorage(context.secrets);

	// Initialize Telemetry
	initializeTelemetry(context);
	const telemetryManager = getTelemetryManager();
	telemetryManager.toggleExtensionTelemetry(true);
	telemetryManager.toggleVSCodeTelemetry(true);

	// Register Chat View Provider
	const chatProvider = new ChatViewProvider(
		context.extensionUri,
		context,
		telemetryManager.getExtensionMiddlewares(),
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('chatView', chatProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	);
	// Initialize CodeIndexing
	CodeIndexing.getInstance(context);

	// Register all commands
	registerCommands(context, chatProvider);

	vscode.window.onDidChangeActiveColorTheme(() => {
		chatProvider.sendThemeInfo();
	});

	// listen to configuration changes (theme name changes)
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('workbench.colorTheme')) {
			chatProvider.sendThemeInfo();
		}
	});

	// Export context for telemetry access
	return { context };
}
