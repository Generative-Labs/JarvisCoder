/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

import { Chat } from '../../types/chats';
interface ChatTitleProps {
	chat: Chat;
}

const ChatTitle: React.FC<ChatTitleProps> = React.memo(({ chat }) => (
	<div
		className={`p-4 bg-ai-bg-01 flex justify-center items-center gap-1.5  cursor-pointer  flex-nowrap`}
	>
		<div
			className="justify-start text-ai-gray-01 text-caption1 font-regular font-inter text-nowrap"
			style={{
				whiteSpace: 'nowrap',
			}}
		>
			{chat.title || 'New Chat'}
		</div>
	</div>
));

export default ChatTitle;
