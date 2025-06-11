/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Parses a multi-line string of commands into an array of individual command strings.
 *
 * This function takes a single string which may contain multiple commands, each on a new line.
 * It splits the input string by newline characters. Each resulting line is then trimmed of
 * leading and trailing whitespace. Lines that are empty after trimming or lines that
 * start with a '#' (comment character) are filtered out.
 *
 * If the input `command` is null, undefined, or not a string, an empty array is returned.
 *
 * @param command - The string containing one or more commands, potentially separated by newlines
 *                  and including comments (lines starting with '#').
 * @returns An array of strings, where each string is a valid command line.
 *          Returns an empty array if the input is invalid or contains no valid commands.
 *
 * @example
 * ```typescript
 * const commands = parseCommands('  # This is a comment\n  ls -la\n  # Another comment\n  pwd  ');
 * // Returns: ['ls -la', 'pwd']
 * ```
 */
export function parseCommands(command: string): string[] {
	if (!command || typeof command !== 'string') {
		return [];
	}
	const lines = command.split('\n');
	return lines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}
