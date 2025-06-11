/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Dexie, { Table } from 'dexie';

import { logger } from './logger';
import { Message } from '../types/chats';

interface ChatDB extends Dexie {
	messages: Table<Message & { session_id: string }, number>;
}
export const db = new Dexie('chatDBv4') as ChatDB;
db.version(1).stores({
	messages: '++id, session_id, text, isUser, type, timestamp',
});

/**
 * Clears all chats and messages from the database
 * @returns A promise that resolves when the operation is complete
 */
export const clearAllChatsAndMessages = async (): Promise<void> => {
	try {
		await db.messages.clear();
		// Log the operation
		logger.debug('Successfully cleared all chats and messages');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to clear chats and messages: ${errorMessage}`);
	}
};

/**
 * Saves a message to the database
 * @param message - The message to save
 * @param sessionId - The session ID of the chat this message belongs to
 * @returns A promise that resolves when the operation is complete
 */
export const saveMessageToDB = async (message: Message, sessionId: string): Promise<void> => {
	try {
		await db.messages.add({
			session_id: sessionId,
			text: message.text,
			isUser: message.isUser,
			type: message.type,
			timestamp: message.timestamp,
			selectionCodes: message.selectionCodes,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to save message to DB: ${errorMessage}`);
	}
};

/**
 * Retrieves messages for a specific chat
 * @param sessionId - The session ID of the chat to get messages for
 * @param limit - Maximum number of messages to return
 * @param offset - Number of messages to skip
 * @returns An array of messages
 */
export const getMessagesFromDB = async (
	sessionId: string,
	limit = 10,
	offset = 0,
): Promise<Message[]> => {
	try {
		return await db.messages
			.where('session_id')
			.equals(sessionId)
			.offset(offset)
			.limit(limit)
			.sortBy('timestamp');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to get messages from DB: ${errorMessage}`);
	}
};
