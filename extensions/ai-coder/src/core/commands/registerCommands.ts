/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';

import { debounce } from 'lodash';
import * as vscode from 'vscode';

import { CodeIndexing } from '../../Indexing/CodeIndexing';
import { AddToChatCodeLensProvider } from '../../providers/addToChatCodeLensProvider';
import { ChatViewProvider } from '../../providers/chatViewProvider';
import { CodeContextStateService } from '../../providers/services/codeContextStateService';
import { Chat, ChatMap, SelectedTextMessageValue } from '../../types/chats';
import { detectLanguageByFilePath } from '../../utils/codeDetector';
import { logger } from '../../utils/logger';

interface ChatQuickPickItem extends vscode.QuickPickItem {
	value: Chat;
}

/**
 * register all commands
 * @param context - VS Code extension context
 * @param chatProvider - chat view provider instance
 */
export function registerCommands(
	context: vscode.ExtensionContext,
	chatProvider: ChatViewProvider,
): void {
	// register CodeLens provider
	registerCodeLensProvider(context);

	// register all commands
	const commands = [
		registerSelectToChatCommand(context, chatProvider),
		registerShowMenuCommand(),
		registerShowHistoryCommand(context, chatProvider),
		registerNewChatCommand(chatProvider),
		registerAddToChatCommand(context, chatProvider),
		registerLogoutCommand(chatProvider),
	];

	// add all commands to subscriptions
	commands.forEach((command) => context.subscriptions.push(command));
}

/**
 * register CodeLens provider
 */
function registerCodeLensProvider(context: vscode.ExtensionContext): void {
	const codeLensProvider = new AddToChatCodeLensProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider),
	);
	vscode.window.onDidChangeTextEditorSelection(() => {
		codeLensProvider.refresh();
	});
}

async function formatSelectedText(
	editor: vscode.TextEditor,
	selectedText: string,
	context: vscode.ExtensionContext,
): Promise<SelectedTextMessageValue[] | null> {
	const codeContextStateService = CodeContextStateService.getInstance(context);
	const fileName = editor.document.fileName;
	const language = detectLanguageByFilePath(fileName);
	const startLine = editor.selection.start.line + 1;
	const endLine = editor.selection.end.line + 1;
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
	const relativePath = path.relative(workspaceRoot, fileName);
	const codeIndexing = CodeIndexing.getInstance(context);
	const isSolidityFile = editor.document.languageId === 'solidity';
	const maxImportDepth = isSolidityFile ? 2 : 1;
	const codeContext = await codeIndexing.getCodeContextForActiveEditor(true, maxImportDepth);
	let filePaths: string[] = [];
	const currentContext = await codeContextStateService.getCodeContext();
	// check if the file and line number is the same
	const isDuplicate = currentContext?.some(
		(item) =>
			item.fileInfo.fullPath === fileName &&
			item.fileInfo.startLine === startLine &&
			item.fileInfo.endLine === endLine,
	);
	if (isDuplicate) {
		return null;
	}
	// Handle the primary file
	if (codeContext?.primaryFile) {
		const primaryFilePath = codeContext.primaryFile.relativePath;
		// Only add if it's a workspace file
		if (codeContext.primaryFile.path.startsWith(workspaceRoot)) {
			filePaths.push(primaryFilePath);
			logger.debug(`Added primary file to context:${primaryFilePath}`);
		}
		if (codeContext?.importedFiles && codeContext.importedFiles.length > 0) {
			const importedPaths = codeContext.importedFiles
				.filter((file) => file.path.startsWith(workspaceRoot)) // Only include workspace files
				.map((file) => file.relativePath);

			if (importedPaths.length > 0) {
				filePaths = [...filePaths, ...importedPaths];
				logger.debug(`🚗 Added imported files to context:${importedPaths}`);
			}
		}
		const activeFilePath = editor.document.uri.fsPath;
		if (activeFilePath.startsWith(workspaceRoot)) {
			const relativePath = path.relative(workspaceRoot, activeFilePath);
			if (!filePaths.includes(relativePath)) {
				filePaths.unshift(relativePath); // Add active file at the beginning
				logger.debug(`🚗 Added active file to context:${relativePath}`);
			}
		}
		filePaths = [...new Set(filePaths)];
		logger.debug(`🚗 Final file paths to send to webview:${filePaths}`);
		// Send the file paths to the webview
	}

	const fileInfo = {
		path: relativePath,
		fullPath: fileName,
		fileName: fileName.split('/').pop() || '',
		startLine,
		endLine,
		language,
	};

	const preCodeContext = {
		text: selectedText,
		fileInfo,
		timestamp: new Date().toISOString(),
		formattedText: language ? `\`\`\`${language}\n${selectedText}\n\`\`\`\n` : selectedText,
		context: filePaths,
	};

	const newCodeContext = await codeContextStateService.addCodeContext(preCodeContext);
	return newCodeContext;
}

/**
 * register select to chat command
 */
function registerSelectToChatCommand(
	context: vscode.ExtensionContext,
	chatProvider: ChatViewProvider,
): vscode.Disposable {
	return vscode.commands.registerCommand('extension.selectToChat', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor?.selection || editor.selection.isEmpty) {
			return;
		}

		const selectedText = editor.document.getText(editor.selection);
		if (!selectedText?.trim()) {
			return;
		}

		try {
			const formattedContent = await formatSelectedText(editor, selectedText, context);
			if (formattedContent) {
				chatProvider.sendSelectedTextToWebview(formattedContent);
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error sending text to chat: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});
}

/**
 * register show menu command
 */
function registerShowMenuCommand(): vscode.Disposable {
	return vscode.commands.registerCommand('ai-training.showMenu', async () => {
		const pick = await vscode.window.showQuickPick([{ label: 'Log Out', value: 'logout' }], {
			placeHolder: 'More Actions',
		});
		if (pick?.value === 'logout') {
			vscode.commands.executeCommand('ai-training.logOut');
		}
	});
}

/**
 * register show history command
 */
function registerShowHistoryCommand(
	context: vscode.ExtensionContext,
	chatProvider: ChatViewProvider,
): vscode.Disposable {
	return vscode.commands.registerCommand('ai-training.showHistory', async () => {
		const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '~';
		const chats = await loadChatHistory(context, workspacePath);
		if (!chats) {
			return;
		}

		const items = formatChatHistoryItems(chats);
		const pick = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a chat history to view',
			matchOnDescription: true,
			matchOnDetail: true,
		});

		if (pick) {
			if (pick.value.sessionId) {
				await chatProvider.setActiveChatCommand(workspacePath, pick.value.sessionId);
			} else {
				await chatProvider.onNewChatCommand();
			}
		}
	});
}

/**
 * register new chat command
 */
function registerNewChatCommand(chatProvider: ChatViewProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'ai-training.newChat',
		debounce(async () => {
			await chatProvider.onNewChatCommand();
		}, 200),
	);
}

/**
 * register add to chat command
 */
function registerAddToChatCommand(
	context: vscode.ExtensionContext,
	chatProvider: ChatViewProvider,
): vscode.Disposable {
	return vscode.commands.registerCommand('ai-training.addToChat', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor?.selection || editor.selection.isEmpty) {
			return;
		}

		const selectedText = editor.document.getText(editor.selection);
		if (!selectedText?.trim()) {
			return;
		}

		try {
			const formattedContent = await formatSelectedText(editor, selectedText, context);
			if (formattedContent) {
				chatProvider.sendSelectedTextToWebview(formattedContent);
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error sending text to chat: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});
}

/**
 * register logout command
 */
function registerLogoutCommand(chatProvider: ChatViewProvider): vscode.Disposable {
	return vscode.commands.registerCommand('ai-training.logOut', async () => {
		vscode.window.showInformationMessage('Logged out!');
		chatProvider.onLogoutCommand();
	});
}

/**
 * load chat history
 */
async function loadChatHistory(
	context: vscode.ExtensionContext,
	workspacePath: string,
): Promise<Chat[] | null> {
	try {
		const chatMaps = await context.globalState.get(`ChatMaps`);
		if (!chatMaps) {
			vscode.window.showInformationMessage('No chat history found.');
			return null;
		}

		const chatMap = chatMaps as ChatMap;
		const chatList = chatMap[workspacePath];
		if (!chatList || chatList.length === 0) {
			vscode.window.showInformationMessage('No chat history found for current workspace.');
			return null;
		}

		return chatList;
	} catch (_error) {
		vscode.window.showErrorMessage('Failed to load chat history.');
		return null;
	}
}

/**
 * format chat history items
 */
function formatChatHistoryItems(chats: Chat[]): ChatQuickPickItem[] {
	const items = chats.map((chat) => ({
		label: chat.title || 'New Chat',
		description: new Date(chat.timestamp).toLocaleString(),
		detail: `Model: ${chat.modelName}`,
		value: chat,
	}));

	items.unshift({
		label: 'New Chat',
		description: '',
		detail: '',
		value: {
			title: 'New Chat',
			sessionId: '',
			modelName: '',
			timestamp: Date.now(),
		},
	});

	return items;
}
