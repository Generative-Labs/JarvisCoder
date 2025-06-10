/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Parses a command string into key-value pairs
 * @param str - The command string to parse (e.g., "kind=init type=command command=npm install")
 * @returns An object containing the parsed key-value pairs
 * @example
 * // returns { kind: 'init', type: 'command', command: 'npm install' }
 * parseCommandString("kind=init type=command command=npm install");
 */
export function parseCommandString(str: string): Record<string, string> {
	const result: Record<string, string> = {};

	// use regex to match key=value pairs
	// const regex = /(\w+)=([^=]+)(?:\s|$)/g;
	// modify regex to handle nested code blocks
	const regex = /(\w+)=([^=\s]+(?:\s+[^=\s]+)*?)(?=\s+\w+=|$)/g;
	let match;

	while ((match = regex.exec(str)) !== null) {
		const [_, key, value] = match;
		// remove whitespace from value
		result[key] = value.trim();
	}

	return result;
}

export function uniqueArray<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

/**
 * mergeArrays
 * @param arrays - arrays to merge
 * @returns merged and deduplicated array
 * @example
 * // returns [1, 2, 3, 4, 5]
 * mergeArrays([1, 2, 3], [3, 4, 5])
 */
export function mergeArrays<T>(...arrays: T[][]): T[] {
	return uniqueArray(arrays.flat());
}
