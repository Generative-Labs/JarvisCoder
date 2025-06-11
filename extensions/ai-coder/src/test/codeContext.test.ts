/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ImportResolver } from '../Indexing/codeContext';

suite('Code Context Tests', () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-context-tests-'));

	// Create test files before running tests
	suiteSetup(() => {
		// Create JavaScript test files
		createTestFile(
			path.join(tempDir, 'main.js'),
			`import { helper } from './helper';
import { utils } from './utils/index';
import * as external from 'external-lib';

function main() {
	helper();
	utils.doSomething();
	external.run();
}

export default main;`,
		);

		createTestFile(
			path.join(tempDir, 'helper.js'),
			`import { utils } from './utils/index';

export function helper() {
	console.log('Helper function');
	utils.log('From helper');
}
`,
		);

		createTestFile(
			path.join(tempDir, 'utils', 'index.js'),
			`export const utils = {
	doSomething: () => console.log('Doing something'),
	log: (message) => console.log(message)
};
`,
		);

		// Create Python test files
		createTestFile(
			path.join(tempDir, 'main.py'),
			`import helper
from utils import utils_func
import os
import sys

def main():
	helper.helper_func()
	utils_func()
	print(os.path.join('a', 'b'))

if __name__ == '__main__':
	main()
`,
		);

		createTestFile(
			path.join(tempDir, 'helper.py'),
			`from utils import utils_func

def helper_func():
	print("Helper function")
	utils_func()
`,
		);

		createTestFile(
			path.join(tempDir, 'utils.py'),
			`def utils_func():
	print("Utility function")
`,
		);

		// Create Solidity test files
		createTestFile(
			path.join(tempDir, 'Contract.sol'),
			`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IContract.sol";
import "./libraries/SafeMath.sol";

contract MyContract is IContract {
	using SafeMath for uint256;

	function doSomething() external override returns (uint256) {
		return 42;
	}
}
`,
		);

		createTestFile(
			path.join(tempDir, 'interfaces', 'IContract.sol'),
			`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IContract {
	function doSomething() external returns (uint256);
}
`,
		);

		createTestFile(
			path.join(tempDir, 'libraries', 'SafeMath.sol'),
			`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SafeMath {
	function add(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a + b;
		require(c >= a, "SafeMath: addition overflow");
		return c;
	}
}
`,
		);
	});

	// Clean up test files after running tests
	suiteTeardown(() => {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			// OR Option 2: Use console.warn() with an ESLint disable comment if cleanup failure is non-critical
			console.error(`Error cleaning up temp directory: ${error}`);
		}
	});

	test('ImportResolver should resolve JavaScript imports', async () => {
		const filePath = path.join(tempDir, 'main.js');
		const fileContent = fs.readFileSync(filePath, 'utf8');

		const imports = await ImportResolver.resolveImports(filePath, fileContent, 'javascript');

		assert.strictEqual(imports.length, 2, 'Should find two local imports');

		const importPaths = imports.map((p) => path.basename(p));
		assert.ok(importPaths.includes('helper.js'), 'Should include helper.js');
		assert.ok(importPaths.includes('index.js'), 'Should include utils/index.js');
	});

	test('ImportResolver should resolve Python imports', async () => {
		const filePath = path.join(tempDir, 'main.py');
		const fileContent = fs.readFileSync(filePath, 'utf8');

		const imports = await ImportResolver.resolveImports(filePath, fileContent, 'python');

		assert.strictEqual(imports.length, 2, 'Should find two local imports');

		const importPaths = imports.map((p) => path.basename(p));
		assert.ok(importPaths.includes('helper.py'), 'Should include helper.py');
		assert.ok(importPaths.includes('utils.py'), 'Should include utils.py');
	});

	test('ImportResolver should resolve Solidity imports', async () => {
		const filePath = path.join(tempDir, 'Contract.sol');
		const fileContent = fs.readFileSync(filePath, 'utf8');

		const imports = await ImportResolver.resolveImports(filePath, fileContent, 'solidity');

		assert.strictEqual(imports.length, 2, 'Should find two local imports');

		const importPaths = imports.map((p) => path.basename(p));
		assert.ok(importPaths.includes('IContract.sol'), 'Should include IContract.sol');
		assert.ok(importPaths.includes('SafeMath.sol'), 'Should include SafeMath.sol');
	});

	test('ImportResolver should handle recursive imports', async () => {
		// Test helper.js which imports utils/index.js
		const filePath = path.join(tempDir, 'helper.js');
		const fileContent = fs.readFileSync(filePath, 'utf8');

		const imports = await ImportResolver.resolveImports(filePath, fileContent, 'javascript');

		assert.strictEqual(imports.length, 1, 'Should find one local import');
		assert.strictEqual(path.basename(imports[0]), 'index.js', 'Should be utils/index.js');

		// Now check the import from the import
		const nestedFilePath = imports[0];
		const nestedFileContent = fs.readFileSync(nestedFilePath, 'utf8');

		const nestedImports = await ImportResolver.resolveImports(
			nestedFilePath,
			nestedFileContent,
			'javascript',
		);

		assert.strictEqual(nestedImports.length, 0, 'utils/index.js should not have imports');
	});
});

/**
 * Helper function to create a test file
 * @param filePath - Path to create the file at
 * @param content - Content to write to the file
 */
function createTestFile(filePath: string, content: string): void {
	const dir = path.dirname(filePath);

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	fs.writeFileSync(filePath, content, 'utf8');
}
