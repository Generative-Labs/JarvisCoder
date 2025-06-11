/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import * as vscode from 'vscode';

import { CodeDiffController } from '../core/codeDiff/CodeDiffController';

suite('CodeDiffController', () => {
	let contextMock: vscode.ExtensionContext;
	let leftUri: vscode.Uri;
	let rightUri: vscode.Uri;
	let testFilePath: string;
	let testFilePath2: string;

	setup(async () => {
		// Create two temporary files for testing
		const tmpDir = require('os').tmpdir();
		testFilePath = require('path').join(tmpDir, `left_${Date.now()}.txt`);
		testFilePath2 = require('path').join(tmpDir, `right_${Date.now()}.txt`);
		require('fs').writeFileSync(testFilePath, 'left content');
		require('fs').writeFileSync(testFilePath2, 'right content');
		leftUri = vscode.Uri.file(testFilePath);
		rightUri = vscode.Uri.file(testFilePath2);
		contextMock = { subscriptions: [] } as unknown as vscode.ExtensionContext;
	});

	teardown(() => {
		// Remove temporary files
		try {
			require('fs').unlinkSync(testFilePath);
		} catch {}
		try {
			require('fs').unlinkSync(testFilePath2);
		} catch {}
	});

	test('should initialize with file URIs', () => {
		const controller = new CodeDiffController(contextMock, leftUri, rightUri);
		assert.ok(controller);
	});

	test('should initialize with in-memory content', () => {
		const controller = new CodeDiffController(contextMock, leftUri, 'in-memory content');
		assert.ok(controller);
	});

	test('acceptChanges should overwrite left file with right file content', async () => {
		const controller = new CodeDiffController(contextMock, leftUri, rightUri);
		await controller.acceptChanges();
		const updated = require('fs').readFileSync(testFilePath, 'utf8');
		assert.strictEqual(updated, 'right content');
	});

	test('acceptChanges should overwrite left file with in-memory content', async () => {
		const controller = new CodeDiffController(contextMock, leftUri, 'new content');
		await controller.acceptChanges();
		const updated = require('fs').readFileSync(testFilePath, 'utf8');
		assert.strictEqual(updated, 'new content');
	});

	test('rejectChanges should not change left file', async () => {
		const controller = new CodeDiffController(contextMock, leftUri, rightUri);
		await controller.rejectChanges();
		const updated = require('fs').readFileSync(testFilePath, 'utf8');
		assert.strictEqual(updated, 'left content');
	});
});
