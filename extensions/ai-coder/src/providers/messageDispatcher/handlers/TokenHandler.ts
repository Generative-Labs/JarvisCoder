/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventMessage, EventResponseMessage } from '../../chatEventMessage';
import { AuthStateService } from '../../services/authStateService';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class TokenHandler implements MessageHandler {
	async handle(data: MessageData, context: MessageContext): Promise<void> {
		const { webview, context: extensionContext } = context;

		if (!extensionContext || !webview) {
			return;
		}

		const authStateService = AuthStateService.getInstance(extensionContext);

		switch (data.type) {
			case EventMessage.GET_TOKEN_INFO:
				webview.postMessage({
					type: EventResponseMessage.TOKEN_INFO,
					value: authStateService.getTokenInfo(),
				});
				break;

			case EventMessage.REQUEST_TOKEN_AND_USER_INFO:
				webview.postMessage({
					type: EventResponseMessage.TOKEN_AND_USER_INFO,
					value: {
						tokenInfo: authStateService.getTokenInfo(),
						userInfo: authStateService.getUserInfo(),
					},
				});
				break;

			case EventMessage.SAVE_TOKEN_INFO:
				await authStateService.saveTokenInfo(data.value);
				webview.postMessage({
					type: EventResponseMessage.TOKEN_INFO,
					value: authStateService.getTokenInfo(),
				});
				break;
		}
	}
}
