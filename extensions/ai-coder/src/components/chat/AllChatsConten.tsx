/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

import { Chat } from '../../types/chats';

type AllChatsContentProps = {
	noWorkspaceChats: Chat[] | null;
	handleOpenChat: (chat: Chat) => void;
};

const AllChatsContent: React.FC<AllChatsContentProps> = React.memo(
	({ noWorkspaceChats, handleOpenChat }) => (
		<div className="self-stretch inline-flex flex-col justify-start items-start gap-2 px-4">
			<div className="self-stretch inline-flex justify-between items-center">
				<div className="justify-start text-ai-gray-05 text-caption1 font-regular font-inter">
					All Conversations
				</div>
				<div className="justify-start text-ai-gray-05 text-caption1 font-regular font-inter">
					View All
				</div>
			</div>
			{noWorkspaceChats?.map((chat) => (
				<div
					className="self-stretch px-3 py-2.5 bg-ai-bg-02 hover:bg-ai-bg-01 rounded-md inline-flex justify-start items-center gap-4 cursor-pointer"
					onClick={() => handleOpenChat(chat)}
				>
					<div className="flex-1 justify-start text-ai-gray-03 text-body font-regular font-inter">
						{chat.title || 'Untitled Chat'}
					</div>
					<div className="justify-start text-ai-gray-05 text-body font-regular font-inter">
						{new Date(chat.timestamp).toLocaleString()}
					</div>
				</div>
			))}
		</div>
	),
);

export default AllChatsContent;
