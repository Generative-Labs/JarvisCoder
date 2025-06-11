/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

const ChatWelcomeContent: React.FC = React.memo(() => (
	<div className="self-stretch inline-flex flex-col justify-center items-center gap-1.5">
		<div className="justify-start text-ai-gray-01 text-title1 font-medium font-inter">Al Chat</div>
		<div className="text-center justify-start text-ai-gray-05 text-body font-regular font-inter">
			Built to make you extraordinarily productive, <br />
			Al Chat is the best way to code with AI.
		</div>
	</div>
));

export default ChatWelcomeContent;
