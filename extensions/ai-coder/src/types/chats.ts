/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSCodeResponseMessage } from '../chat';
import { EventResponseMessage } from '../providers/chatEventMessage';

export interface Chat {
	title: string;
	sessionId: string;
	modelName: string;
	timestamp: number;
}
export type ChatMap = Record<string, Chat[]>;

export interface Message {
	id?: number;
	text: string;
	isUser: boolean;
	type?: 'normal' | 'selection' | 'terminal'; // Add message type
	timestamp?: number;
	selectionCodes?: SelectedTextMessageValue[];
}

export interface ChatUpdateError {
	type: 'error' | 'success';
	value: string;
}

export interface SelectedTextMessageValue {
	fileInfo: {
		path: string;
		fullPath: string;
		startLine: number;
		endLine: number;
		language: string;
		fileName: string;
	};
	context: string[];
	timestamp: string;
	formattedText: string;
	text?: string;
}

export interface SelectedTextMessage extends VSCodeResponseMessage {
	type: EventResponseMessage.CODE_CONTEXT_SELECTION;
	value: SelectedTextMessageValue[];
	command: string;
}
