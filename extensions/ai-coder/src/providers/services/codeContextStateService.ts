/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { SelectedTextMessageValue } from '../../types/chats';

export class CodeContextStateService {
	private static instance: CodeContextStateService;
	private context: vscode.ExtensionContext;

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	public static getInstance(context: vscode.ExtensionContext): CodeContextStateService {
		if (!CodeContextStateService.instance) {
			CodeContextStateService.instance = new CodeContextStateService(context);
		}
		return CodeContextStateService.instance;
	}

	public async saveCodeContext(
		codeContext: SelectedTextMessageValue[],
	): Promise<SelectedTextMessageValue[]> {
		await this.context.globalState.update('codeContext', codeContext);
		return codeContext;
	}

	public async addCodeContext(
		codeContext: SelectedTextMessageValue,
	): Promise<SelectedTextMessageValue[]> {
		const currentContext = (await this.getCodeContext()) || [];
		const newContext = [...currentContext, codeContext];
		await this.saveCodeContext(newContext);
		return newContext;
	}

	public async getCodeContext(): Promise<SelectedTextMessageValue[] | undefined> {
		return await this.context.globalState.get('codeContext');
	}

	public async clearCodeContext(): Promise<void> {
		await this.context.globalState.update('codeContext', undefined);
	}
}
