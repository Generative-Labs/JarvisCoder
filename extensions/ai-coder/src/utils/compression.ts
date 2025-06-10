/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compresses text by removing extra whitespace and replacing common patterns with shorter versions
 * @param text - The text to compress
 * @returns The compressed text
 */
export const compressText = (text: string): string => {
	// Remove extra whitespace
	let compressed = text.replace(/\s+/g, ' ');

	// Replace common code patterns with shorter versions
	const patterns = {
		'function ': 'f ',
		'const ': 'c ',
		'let ': 'l ',
		'return ': 'r ',
		'export ': 'e ',
		'import ': 'i ',
		'class ': 'cl ',
		'interface ': 'int ',
		'type ': 't ',
		'async ': 'a ',
		'await ': 'aw ',
		'Promise<': 'P<',
		'=>': '=>',
	};

	Object.entries(patterns).forEach(([pattern, replacement]) => {
		compressed = compressed.replace(new RegExp(pattern, 'g'), replacement);
	});

	return compressed;
};

/**
 * Decompresses text by restoring common patterns to their original form
 * @param compressed - The compressed text to decompress
 * @returns The decompressed text
 */
export const decompressText = (compressed: string): string => {
	let decompressed = compressed;

	const patterns = {
		'f ': 'function ',
		'c ': 'const ',
		'l ': 'let ',
		'r ': 'return ',
		'e ': 'export ',
		'i ': 'import ',
		'cl ': 'class ',
		'int ': 'interface ',
		't ': 'type ',
		'a ': 'async ',
		'aw ': 'await ',
		'P<': 'Promise<',
		'=>': '=>',
	};

	Object.entries(patterns).forEach(([pattern, replacement]) => {
		decompressed = decompressed.replace(new RegExp(pattern, 'g'), replacement);
	});

	return decompressed;
};
