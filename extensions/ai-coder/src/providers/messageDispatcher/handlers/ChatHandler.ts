/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { CodeIndexing } from '../../../Indexing/CodeIndexing';
import { Chat } from '../../../types/chats';
import { Logger } from '../../../utils/logger';
import { EventMessage, EventResponseMessage } from '../../chatEventMessage';
import { ChatStateService } from '../../services/chatStateService';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class ChatHandler implements MessageHandler {
	private chatStateService: ChatStateService;
	private context: vscode.ExtensionContext;
	private workspacePath: string;

	constructor(
		chatStateService: ChatStateService,
		context: vscode.ExtensionContext,
		workspacePath: string,
	) {
		this.chatStateService = chatStateService;
		this.context = context;
		this.workspacePath = workspacePath;
	}

	async handle(data: MessageData, context: MessageContext): Promise<void> {
		const { webview } = context;

		switch (data.type) {
			case EventMessage.GET_CHATS:
				await this.handleGetChats(webview);
				break;

			case EventMessage.OPEN_NEW_CHAT: {
				const new_chat = data.value as Chat;
				await this.chatStateService.openNewChat(this.workspacePath, new_chat);
				await this.handleGetChats(webview);
				CodeIndexing.getInstance(this.context).setSessionId(new_chat.sessionId);
				break;
			}
			case EventMessage.DELETE_CHAT:
				this.chatStateService.deleteChat(this.workspacePath, data.value as string);
				break;

			case EventMessage.GET_ACTIVE_CHAT: {
				const active_chat = (await this.chatStateService.getActiveChat()) as Chat;
				if (active_chat) {
					CodeIndexing.getInstance(this.context).setSessionId(active_chat.sessionId);
				}
				break;
			}

			case EventMessage.SET_ACTIVE_CHAT:
				this.chatStateService.setActiveChat(this.workspacePath, data.value as string);
				break;

			case EventMessage.MOVE_CHAT_TO_NO_WORKSPACE: {
				const sessionId = data.value as string;
				await this.chatStateService.moveChatToNoWorkspace(this.workspacePath, sessionId);
				await this.handleGetChats(webview);
				break;
			}

			case EventMessage.GET_NO_WORKSPACE_CHATS: {
				const noWorkspaceChats = await this.chatStateService.getChatsByPath('~');
				if (!noWorkspaceChats) {
					return;
				}
				if (!webview) {
					return;
				}
				webview.postMessage({
					type: EventResponseMessage.NO_WORKSPACE_CHATS,
					value: noWorkspaceChats,
				});
				break;
			}

			case EventMessage.UPDATE_CHAT_TITLE: {
				try {
					const params = data.value as { sessionId: string; title: string };
					this.chatStateService.updateChatTitle(this.workspacePath, params.sessionId, params.title);
				} catch (error) {
					Logger.error(
						'Error updating chat title:',
						error instanceof Error ? error : new Error(String(error)),
					);
				}
				break;
			}
		}
	}

	private async handleGetChats(webview: vscode.Webview | undefined): Promise<void> {
		if (!webview) {
			return;
		}
		try {
			const chats = await this.chatStateService.getChatsByPath(this.workspacePath);
			const activeChat = await this.chatStateService.getActiveChat();
			if (!chats || !activeChat) {
				return;
			}
			webview.postMessage({
				type: EventResponseMessage.CHATS,
				value: chats,
			});
			webview.postMessage({
				type: EventResponseMessage.ACTIVE_CHAT,
				value: activeChat,
			});
		} catch (_error) {
			webview.postMessage({
				type: EventResponseMessage.CHATS,
				value: [],
			});
			webview.postMessage({
				type: EventResponseMessage.ACTIVE_CHAT,
				value: undefined,
			});
		}
	}

	public async handleGetActiveChat(webview: vscode.Webview | undefined): Promise<void> {
		if (!webview) {
			return;
		}
		try {
			const activeChat = await this.chatStateService.getActiveChat();
			if (!activeChat) {
				return;
			}
			webview.postMessage({
				type: EventResponseMessage.ACTIVE_CHAT,
				value: activeChat,
			});
		} catch (error) {
			webview.postMessage({
				type: EventResponseMessage.ERROR_MESSAGE,
				value: error instanceof Error ? error.message : 'Error getting chats',
			});
		}
	}

	/**
	 * Set active chat session
	 * Static method that can be used without creating a ChatHandler instance
	 */
	static async setActiveChat(
		context: vscode.ExtensionContext,
		path: string,
		sessionId: string,
		webview?: vscode.Webview,
	): Promise<void> {
		const chatStateService = ChatStateService.getInstance(context);
		const codeIndexing = CodeIndexing.getInstance(context);
		await chatStateService.setActiveChat(path, sessionId);
		codeIndexing.setSessionId(sessionId);

		// Execute the same logic as original _handleGetActiveChat
		if (webview) {
			try {
				const activeChat = await chatStateService.getActiveChat();
				if (activeChat) {
					webview.postMessage({
						type: EventResponseMessage.ACTIVE_CHAT,
						value: activeChat,
					});
				}
			} catch (error) {
				webview.postMessage({
					type: EventResponseMessage.ERROR_MESSAGE,
					value: error instanceof Error ? error.message : 'Error getting active chat',
				});
			}
		}
	}

	/**
	 * Get chat list and active chat
	 * Static method that can be used without creating a ChatHandler instance
	 */
	static async getChats(
		context: vscode.ExtensionContext,
		path: string,
		webview?: vscode.Webview,
	): Promise<{ chats: Chat[]; activeChat: Chat | undefined }> {
		const chatStateService = ChatStateService.getInstance(context);

		try {
			const chats = await chatStateService.getChatsByPath(path);
			const activeChat = await chatStateService.getActiveChat();

			if (webview) {
				webview.postMessage({
					type: EventResponseMessage.CHATS,
					value: chats || [],
				});

				if (activeChat) {
					webview.postMessage({
						type: EventResponseMessage.ACTIVE_CHAT,
						value: activeChat,
					});
				}
			}

			return {
				chats: chats || [],
				activeChat,
			};
		} catch (error) {
			if (webview) {
				webview.postMessage({
					type: EventResponseMessage.CHATS,
					value: [],
				});
				webview.postMessage({
					type: EventResponseMessage.ERROR_MESSAGE,
					value: error instanceof Error ? error.message : 'Error getting chats',
				});
			}

			return {
				chats: [],
				activeChat: undefined,
			};
		}
	}
}
