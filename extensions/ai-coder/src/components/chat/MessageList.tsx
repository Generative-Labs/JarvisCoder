/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useState } from 'react';

import MessageItem from './MessageItem';
import { Message } from '../../types/chats';
import LoadingText from '../common/LoadingText';

interface MessageListProps {
	messages: Message[];
	lastMessage: Message | null;
	isTyping: 'default' | 'typing' | 'done';
	errorMessage: string;
	isThinking?: boolean;
}

const MessageList: React.FC<MessageListProps> = React.memo(
	({ messages, lastMessage, isTyping, errorMessage, isThinking }) => {
		// Render the message list
		const renderedMessages = useMemo(
			() =>
				messages.map((message, idx) => {
					const typingState = idx === messages.length - 1 && isTyping === 'typing' ? 'typing' : 'done';
					return <MessageItem key={idx} message={message} typingState={typingState} />;
				}),
			[messages, isTyping],
		);

		// Render the last message (the message being typed)
		const renderedLastMessage = useMemo(() => {
			if (!lastMessage) {
				return null;
			}
			return (
				<MessageItem
					message={lastMessage}
					typingState={isTyping === 'typing' ? 'typing' : 'done'}
					isThinking={isThinking}
				/>
			);
		}, [lastMessage, isTyping]);

		return (
			<div className="w-full flex flex-col gap-4">
				{renderedMessages}
				{renderedLastMessage}
				{errorMessage && <LoadingText text={errorMessage} />}
				{isTyping === 'typing' && <LoadingText text="Generating" />}
			</div>
		);
	},
);

export default MessageList;
