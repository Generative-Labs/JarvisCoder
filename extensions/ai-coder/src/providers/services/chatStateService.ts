/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { ChatMap, ChatUpdateError, Chat } from '../../types/chats';

export class ChatStateService {
	private static instance: ChatStateService;
	private context: vscode.ExtensionContext;

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	public static getInstance(context: vscode.ExtensionContext): ChatStateService {
		if (!ChatStateService.instance) {
			ChatStateService.instance = new ChatStateService(context);
		}
		return ChatStateService.instance;
	}

	public async saveChats(chats: ChatMap): Promise<ChatUpdateError | void> {
		await this.context.globalState.update(`ChatMaps`, chats);
	}

	public async getChats(): Promise<ChatMap | undefined> {
		return this.context.globalState.get(`ChatMaps`);
	}

	private async checkPath(chats: ChatMap | undefined, path: string): Promise<boolean> {
		if (!chats) {
			return false;
		}
		return Object.keys(chats).includes(path);
	}

	public async setActiveChat(path: string, sessionId: string): Promise<void> {
		const chats = await this.getChats();
		if (!this.checkPath(chats, path)) {
			throw new Error('Path not found');
		}
		const chat = chats?.[path]?.find((c) => c?.sessionId === sessionId);
		if (!chat) {
			throw new Error('Chat not found');
		}
		await this.context.globalState.update(`activeChat`, chat);
	}

	public async getActiveChat(): Promise<Chat | undefined> {
		return this.context.globalState.get(`activeChat`);
	}

	public async getChatsByPath(path: string): Promise<Chat[] | undefined> {
		const chats = await this.getChats();

		if (!chats) {
			throw new Error('No chats found');
		}
		if (!Object.keys(chats).includes(path)) {
			throw new Error('Path not found');
		}
		return chats[path];
	}

	public async deleteChat(path: string, sessionId: string): Promise<ChatUpdateError | void> {
		const chats = await this.getChats();
		if (!chats) {
			throw new Error('No chats found');
		}
		if (!Object.keys(chats).includes(path)) {
			throw new Error('Path not found');
		}
		const newChats = { ...chats };
		newChats[path] = newChats[path].filter((chat) => chat.sessionId !== sessionId);
		const activeChat = await this.getActiveChat();
		if (activeChat?.sessionId === sessionId) {
			await this.context.globalState.update(`activeChat`, newChats[path][newChats[path].length - 1]);
		}
		await this.saveChats(newChats);
	}

	public async openNewChat(path: string, chat: Chat): Promise<void> {
		const oriChats = await this.getChats();
		let chatMap: ChatMap = oriChats ?? {};
		if (!oriChats) {
			chatMap = {
				[path]: [chat],
			};
		} else {
			if (!Object.keys(chatMap).includes(path)) {
				chatMap[path] = [chat];
			} else {
				chatMap[path].unshift(chat);
			}
		}
		await this.saveChats(chatMap);
		await this.setActiveChat(path, chat.sessionId);
	}

	public async updateChatTitle(path: string, sessionId: string, title: string): Promise<void> {
		const oriChats = await this.getChats();
		if (!oriChats) {
			throw new Error('No chats found');
		}
		const chatMap: ChatMap = oriChats ?? {};
		if (!Object.keys(chatMap).includes(path)) {
			throw new Error('Path not found');
		}
		const chat = chatMap[path].find((c) => c.sessionId === sessionId);
		if (!chat) {
			throw new Error('Chat not found');
		}
		chatMap[path] = chatMap[path].map((c) => (c.sessionId === sessionId ? { ...c, title } : c));
		await this.saveChats(chatMap);
	}

	public async clearAllStorage(): Promise<void> {
		await this.context.globalState.update(`ChatMaps`, undefined);
		await this.context.globalState.update(`activeChat`, undefined);
	}

	public async moveChatToNoWorkspace(path: string, sessionId: string): Promise<void> {
		const chats = await this.getChats();
		if (!chats) {
			throw new Error('No chats found');
		}
		const chatMap: ChatMap = chats ?? {};
		const sourceKey = '~';
		const targetKey = path;
		const itemId = sessionId;
		const data = chatMap;

		if (!data[sourceKey] || !data[targetKey]) {
			return;
		}

		const sourceArray = data[sourceKey];
		const itemIndex = sourceArray.findIndex((item) => item.sessionId === itemId);

		if (itemIndex === -1) {
			return;
		}
		const newData = { ...data };
		const itemToMove = sourceArray[itemIndex];
		newData[sourceKey] = sourceArray.filter((item) => item.sessionId !== itemId);
		newData[targetKey] = [...data[targetKey], itemToMove];
		await this.saveChats(newData);
		await this.setActiveChat(targetKey, itemId);
	}
}
