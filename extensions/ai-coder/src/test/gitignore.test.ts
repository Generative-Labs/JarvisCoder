/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GitignoreHandler } from '../Indexing/GitignoreHandler';

// Type-safe interface for testing private methods
interface GitignoreHandlerTestInterface {
	parseGitignoreContent(content: string): string[];
	matchesPattern(filePath: string, pattern: string): boolean;
	getLoadedPatterns(): Map<string, string[]>;
	dispose(): void;
}

suite('GitignoreHandler Tests', () => {
	let handler: GitignoreHandler;
	let testHandler: GitignoreHandlerTestInterface;
	let tempDir: string;

	suiteSetup(() => {
		// Create a temporary directory for tests
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'));
	});

	setup(() => {
		handler = new GitignoreHandler();
		// Cast to test interface for type safety
		testHandler = handler as unknown as GitignoreHandlerTestInterface;
	});

	teardown(() => {
		if (handler) {
			handler.dispose();
		}
	});

	suiteTeardown(() => {
		// Clean up temp directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	suite('parseGitignoreContent', () => {
		test('should parse basic gitignore patterns correctly', () => {
			const gitignoreContent = `
# This is a comment
node_modules/
*.log
dist
.env
!important.log
`;
			const patterns = testHandler.parseGitignoreContent(gitignoreContent);

			assert.strictEqual(patterns.length, 5);
			assert.ok(patterns.includes('node_modules/'));
			assert.ok(patterns.includes('*.log'));
			assert.ok(patterns.includes('dist'));
			assert.ok(patterns.includes('.env'));
			assert.ok(patterns.includes('important.log')); // negation pattern handled
		});

		test('should ignore comments and empty lines', () => {
			const gitignoreContent = `
# Comment line
	# Another comment

*.log
   
# Final comment
`;
			const patterns = testHandler.parseGitignoreContent(gitignoreContent);

			assert.strictEqual(patterns.length, 1);
			assert.ok(patterns.includes('*.log'));
		});

		test('should handle negation patterns', () => {
			const gitignoreContent = `
*.log
!important.log
!debug.log
`;
			const patterns = testHandler.parseGitignoreContent(gitignoreContent);

			assert.strictEqual(patterns.length, 3);
			assert.ok(patterns.includes('*.log'));
			assert.ok(patterns.includes('important.log'));
			assert.ok(patterns.includes('debug.log'));
		});

		test('should trim whitespace from patterns', () => {
			const gitignoreContent = `
	*.log  
	node_modules/   
	dist	
`;
			const patterns = testHandler.parseGitignoreContent(gitignoreContent);

			assert.strictEqual(patterns.length, 3);
			assert.ok(patterns.includes('*.log'));
			assert.ok(patterns.includes('node_modules/'));
			assert.ok(patterns.includes('dist'));
		});
	});

	suite('matchesPattern', () => {
		test('should match simple filename patterns', () => {
			const testCases = [
				{ path: 'src/test.log', pattern: '*.log', expected: true },
				{ path: 'test.log', pattern: '*.log', expected: true },
				{ path: 'app.log.old', pattern: '*.log', expected: false },
				{ path: 'src/test.txt', pattern: '*.log', expected: false },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should match directory patterns', () => {
			const testCases = [
				{ path: 'node_modules/package/index.js', pattern: 'node_modules/', expected: true },
				{ path: 'src/node_modules/test.js', pattern: 'node_modules/', expected: true },
				{ path: 'node_modules_backup/file.js', pattern: 'node_modules/', expected: false },
				{ path: 'src/components/node_modules/lib.js', pattern: 'node_modules/', expected: true },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should match root patterns', () => {
			const testCases = [
				{ path: 'dist/bundle.js', pattern: '/dist', expected: true },
				{ path: 'dist/sub/file.js', pattern: '/dist', expected: true },
				{ path: 'src/dist/file.js', pattern: '/dist', expected: false },
				{ path: 'build/output.js', pattern: '/dist', expected: false },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should match wildcard patterns', () => {
			const testCases = [
				{ path: 'temp', pattern: 'temp', expected: true },
				{ path: 'src/temp', pattern: 'temp', expected: true },
				{ path: 'temporary', pattern: 'temp', expected: false },
				{ path: 'src/temp/file.txt', pattern: 'temp', expected: true },
				{ path: 'backup.log', pattern: '*.log', expected: true },
				{ path: 'app.log.backup', pattern: '*.log', expected: false },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should handle edge cases', () => {
			const testCases = [
				{ path: '', pattern: '*', expected: false },
				{ path: 'file.txt', pattern: '', expected: false },
				{ path: '.env', pattern: '.env', expected: true },
				{ path: 'src/.env', pattern: '.env', expected: true },
				{ path: '.env.local', pattern: '.env', expected: false },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});
	});

	suite('real-world patterns', () => {
		test('should handle typical Node.js gitignore patterns', () => {
			const testCases = [
				// Node.js patterns
				{ path: 'node_modules/express/index.js', pattern: 'node_modules/', expected: true },
				{ path: 'npm-debug.log', pattern: '*.log', expected: true },
				{ path: 'yarn-error.log', pattern: '*.log', expected: true },
				{ path: 'dist/bundle.js', pattern: 'dist/', expected: true },
				{ path: 'build/output.js', pattern: 'build/', expected: true },
				{ path: '.env', pattern: '.env*', expected: true },
				{ path: '.env.local', pattern: '.env*', expected: true },
				{ path: 'coverage/index.html', pattern: 'coverage/', expected: true },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Node.js pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should handle typical Python gitignore patterns', () => {
			const testCases = [
				{ path: '__pycache__/main.cpython-39.pyc', pattern: '__pycache__/', expected: true },
				{ path: 'src/__pycache__/utils.pyc', pattern: '__pycache__/', expected: true },
				{ path: 'app.pyc', pattern: '*.pyc', expected: true },
				{ path: 'venv/lib/python3.9/site-packages/', pattern: 'venv/', expected: true },
				{ path: '.pytest_cache/v/cache/nodeids', pattern: '.pytest_cache/', expected: true },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`Python pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});

		test('should handle IDE and OS patterns', () => {
			const testCases = [
				{ path: '.vscode/settings.json', pattern: '.vscode/', expected: true },
				{ path: '.idea/workspace.xml', pattern: '.idea/', expected: true },
				{ path: '.DS_Store', pattern: '.DS_Store', expected: true },
				{ path: 'src/.DS_Store', pattern: '.DS_Store', expected: true },
				{ path: 'Thumbs.db', pattern: 'Thumbs.db', expected: true },
			];

			testCases.forEach(({ path, pattern, expected }) => {
				const matches = testHandler.matchesPattern(path, pattern);
				assert.strictEqual(
					matches,
					expected,
					`IDE/OS pattern ${pattern} should ${expected ? 'match' : 'not match'} ${path}`,
				);
			});
		});
	});

	test('should return loaded patterns for debugging', () => {
		const patterns = testHandler.getLoadedPatterns();
		assert.ok(patterns instanceof Map, 'Should return a Map of patterns');
	});
});
