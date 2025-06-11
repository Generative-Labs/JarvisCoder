/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * File patterns for code indexing and watching
 */

export const SOURCE_FILE_PATTERNS = [
	// Source code files
	'**/*.{sol,ts,tsx,js,jsx,py,toml,gitmodules}',

	// Configuration files
	// '**/{package.json,package-lock.json,yarn.lock,pnpm-lock.yaml}',
	// '**/{tsconfig.json,jsconfig.json,tsconfig.*.json,jsconfig.*.json}',
	// '**/{.eslintrc*,.prettierrc*,.babelrc*,.browserslistrc}',
	// '**/{webpack.config.*,vite.config.*,rollup.config.*}',
	// '**/{.env*,.env.*}',
	// '**/*.toml',  // For Rust's Cargo.toml and Python's pyproject.toml
	// '**/*.lock', // Include other lock files
	// '**/hardhat.config.*',
	// '**/truffle-config.*',
	// '**/foundry.toml',
	// '**/remix.config.*',
	// '**/requirements*.txt',
	// '**/setup.py',
	// '**/Pipfile',
	// '**/Pipfile.lock',
	// '**/pyproject.toml'
];

/**
 * Patterns for directories that should be excluded from watching/indexing
 */
export const EXCLUDED_DIRECTORIES = [
	'**/node_modules/**',
	'**/lib/forge-std/**',
	'**/forge-std/**',
	'**/lib/openzeppelin-contracts/**',
	'**/.git/**',
	'**/dist/**',
	'**/build/**',
	'**/out/**',
	'**/coverage/**',
	'**/.next/**',
	'**/.vscode-test/**',
	'**/__tests__/**',
	'**/*.test.*',
	'**/*.spec.*',
];
