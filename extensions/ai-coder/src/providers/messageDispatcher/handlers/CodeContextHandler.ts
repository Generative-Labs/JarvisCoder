/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodeContextStateService } from '../../services/codeContextStateService';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class CodeContextHandler implements MessageHandler {
	private codeContextStateService: CodeContextStateService;

	constructor(codeContextStateService: CodeContextStateService) {
		this.codeContextStateService = codeContextStateService;
	}

	async handle(_data: MessageData, _context: MessageContext): Promise<void> {
		await this.codeContextStateService.clearCodeContext();
	}
}
