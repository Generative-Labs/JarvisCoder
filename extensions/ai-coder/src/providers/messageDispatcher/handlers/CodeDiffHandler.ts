/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as vscode from 'vscode';

import { CodeDiffController } from '../../../core/codeDiff/CodeDiffController';
import { EventMessage } from '../../chatEventMessage';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class CodeDiffHandler implements MessageHandler {
	async handle(data: MessageData, context: MessageContext): Promise<void> {
		const { context: extensionContext } = context;

		if (!extensionContext) {
			return;
		}

		switch (data.type) {
			case EventMessage.SHOW_CODE_DIFF:
				await CodeDiffHandler.showCodeDiff(extensionContext, data.value as string);
				break;

			case EventMessage.ACCEPT_ALL_CHANGES:
				await CodeDiffHandler.acceptAllChanges(extensionContext, data.value as string);
				break;

			case EventMessage.REJECT_ALL_CHANGES:
				await CodeDiffHandler.rejectAllChanges(extensionContext, data.value as string);
				break;
		}
	}

	/**
	 * Display code differences
	 * Static method that can be used without creating a CodeDiffHandler instance
	 */
	static async showCodeDiff(context: vscode.ExtensionContext, value: string): Promise<void> {
		const diff = JSON.parse(value);
		const rightContent = diff.rightContent ? diff.rightContent : vscode.Uri.file(diff.rightFile);

		const leftFileAbsPath = await CodeDiffHandler.getLeftFileAbsPath(diff.leftFile);

		let leftUri: vscode.Uri = vscode.Uri.file(leftFileAbsPath);
		if (!fs.existsSync(leftFileAbsPath)) {
			// If left file does not exist, create a temporary empty file for diff
			const tmpDir = os.tmpdir();
			const tmpFile = path.join(tmpDir, `empty_left_${Date.now()}.tmp`);
			fs.writeFileSync(tmpFile, '', 'utf8');
			leftUri = vscode.Uri.file(tmpFile);
		}
		const diffController = new CodeDiffController(context, leftUri, rightContent);
		diffController.showDiff();
	}

	/**
	 * Accept all changes
	 * Static method that can be used without creating a CodeDiffHandler instance
	 */
	static async acceptAllChanges(context: vscode.ExtensionContext, value: string): Promise<void> {
		const diff = JSON.parse(value);
		const rightContent = diff.rightContent ? diff.rightContent : vscode.Uri.file(diff.rightFile);
		const leftFileAbsPath = await CodeDiffHandler.getLeftFileAbsPath(diff.leftFile);

		// If left file does not exist, create it and write rightContent
		if (!fs.existsSync(leftFileAbsPath)) {
			// Ensure parent directory exists
			fs.mkdirSync(path.dirname(leftFileAbsPath), { recursive: true });
			if (typeof rightContent === 'string') {
				// Write rightContent string to left file
				fs.writeFileSync(leftFileAbsPath, rightContent, 'utf8');
			} else if (rightContent && typeof rightContent.fsPath === 'string') {
				// If rightContent is a vscode.Uri (file), copy its content to left file
				if (fs.existsSync(rightContent.fsPath)) {
					const content = fs.readFileSync(rightContent.fsPath, 'utf8');
					fs.writeFileSync(leftFileAbsPath, content, 'utf8');
				} else {
					// If right file does not exist, fallback to empty
					fs.writeFileSync(leftFileAbsPath, '', 'utf8');
				}
			} else {
				// Fallback: write empty content
				fs.writeFileSync(leftFileAbsPath, '', 'utf8');
			}
		}

		const diffController = new CodeDiffController(
			context,
			vscode.Uri.file(leftFileAbsPath),
			rightContent,
		);
		await diffController.acceptChanges();
	}

	/**
	 * Reject all changes
	 * Static method that can be used without creating a CodeDiffHandler instance
	 */
	static async rejectAllChanges(context: vscode.ExtensionContext, value: string): Promise<void> {
		const diff = JSON.parse(value);
		const rightContent = diff.rightContent ? diff.rightContent : vscode.Uri.file(diff.rightFile);
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const rootPath =
			workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : '';
		const leftFileAbsPath = path.join(rootPath, diff.leftFile);
		const diffController = new CodeDiffController(
			context,
			vscode.Uri.file(leftFileAbsPath),
			rightContent,
		);
		await diffController.rejectChanges();
	}

	/**
	 * Get absolute path for left file
	 * Static method that can be used without creating a CodeDiffHandler instance
	 */
	static async getLeftFileAbsPath(leftFile: string): Promise<string> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const activeTerminal = vscode.window.activeTerminal;

		// get current working directory
		let currentWorkingDir = '';
		if (activeTerminal) {
			// use processId to get the working directory of the terminal
			const processId = await activeTerminal.processId;
			if (processId) {
				// get current working directory on macOS/Linux
				const result = await new Promise<string>((resolve) => {
					const { exec } = require('child_process');
					exec(
						`lsof -p ${processId} | grep cwd | awk '{print $9}'`,
						(error: Error | null, stdout: string) => {
							if (error) {
								resolve('');
							} else {
								resolve(stdout.trim());
							}
						},
					);
				});
				currentWorkingDir = result;
			}
		}

		// if currentWorkingDir is empty, use workspace root directory
		if (!currentWorkingDir) {
			currentWorkingDir =
				workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : '';
		}

		// use current working directory to resolve file path
		return path.join(currentWorkingDir, leftFile);
	}
}
