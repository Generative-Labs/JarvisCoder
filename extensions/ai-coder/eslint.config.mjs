/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import pluginJsdoc from 'eslint-plugin-jsdoc';

// Fake local plugin to avoid errors
const localPlugin = {
	rules: {
		'code-no-unexternalized-strings': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-translation-remind': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-native-private': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-parameter-properties-must-have-explicit-accessibility': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-nls-in-standalone-editor': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-potentially-unsafe-disposables': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-dangerous-type-assertions': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-standalone-editor': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-must-use-super-dispose': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-declare-service-brand': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-layering': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-unused-expressions': {
			meta: { type: 'problem' },
			create: () => ({})
		},
		'code-no-static-self-ref': {
			meta: { type: 'problem' },
			create: () => ({})
		}
	}
};

export default [
	// Global ignores
	{
		ignores: [
			'out/**',
			'dist/**',
			'node_modules/**',
			'**/*.test.ts',
			'**/*.test.tsx'
		],
	},
	// All files (JS and TS)
	{
		files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		plugins: {
			'local': localPlugin,
		},
		rules: {
			'constructor-super': 'warn',
			'curly': 'warn',
			'eqeqeq': 'warn',
			'prefer-const': [
				'warn',
				{
					'destructuring': 'all'
				}
			],
			'no-buffer-constructor': 'warn',
			'no-caller': 'warn',
			'no-case-declarations': 'warn',
			'no-debugger': 'warn',
			'no-duplicate-case': 'warn',
			'no-duplicate-imports': 'warn',
			'no-eval': 'warn',
			'no-async-promise-executor': 'warn',
			'no-extra-semi': 'warn',
			'no-new-wrappers': 'warn',
			'no-redeclare': 'off',
			'no-sparse-arrays': 'warn',
			'no-throw-literal': 'warn',
			'no-unsafe-finally': 'warn',
			'no-unused-labels': 'warn',
			'no-misleading-character-class': 'warn',
			'no-var': 'warn',
			'semi': 'off',
			'local/code-translation-remind': 'off',
			'local/code-no-native-private': 'off',
			'local/code-parameter-properties-must-have-explicit-accessibility': 'off',
			'local/code-no-nls-in-standalone-editor': 'off',
			'local/code-no-potentially-unsafe-disposables': 'off',
			'local/code-no-dangerous-type-assertions': 'off',
			'local/code-no-standalone-editor': 'off',
			'local/code-no-unexternalized-strings': 'off',
			'local/code-must-use-super-dispose': 'off',
			'local/code-declare-service-brand': 'off',
			'local/code-layering': 'off',
		},
	},
	// TS
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsParser,
		},
		plugins: {
			'@stylistic/ts': stylisticTs,
			'@typescript-eslint': typescriptEslint,
			'local': localPlugin,
			'jsdoc': pluginJsdoc,
		},
		rules: {
			'@stylistic/ts/semi': 'warn',
			'@stylistic/ts/member-delimiter-style': 'warn',
			'local/code-no-unused-expressions': 'off',
			'jsdoc/no-types': 'warn',
			'local/code-no-static-self-ref': 'off'
		}
	}
];
