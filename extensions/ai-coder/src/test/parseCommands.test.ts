/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import { parseCommands } from '../utils/parseCommands';

suite('parseCommands', () => {
	test('should return an empty array for null input', () => {
		// @ts-expect-error Testing invalid input
		assert.deepStrictEqual(parseCommands(null), []);
	});

	test('should return an empty array for undefined input', () => {
		// @ts-expect-error Testing invalid input
		assert.deepStrictEqual(parseCommands(undefined), []);
	});

	test('should return an empty array for non-string input like a number', () => {
		// @ts-expect-error Testing invalid input
		assert.deepStrictEqual(parseCommands(123), []);
	});

	test('should return an empty array for an empty string', () => {
		assert.deepStrictEqual(parseCommands(''), []);
	});

	test('should parse a single command correctly', () => {
		assert.deepStrictEqual(parseCommands('singleCommand'), ['singleCommand']);
	});

	test('should parse multiple commands separated by newlines', () => {
		const input = 'command1\ncommand2\ncommand3';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2', 'command3']);
	});

	test('should trim leading and trailing whitespace from each command', () => {
		const input = '  command1  \n\tcommand2\t\n command3 ';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2', 'command3']);
	});

	test('should filter out empty lines', () => {
		const input = 'command1\n\ncommand2\n\n\ncommand3';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2', 'command3']);
	});

	test('should filter out lines that become empty after trimming', () => {
		const input = 'command1\n   \ncommand2\n\t\ncommand3';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2', 'command3']);
	});

	test('should filter out lines starting with # (comments)', () => {
		const input = '#this is a comment\ncommand1\n# another comment\ncommand2';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2']);
	});

	test('should filter out lines starting with # even with leading whitespace', () => {
		const input = '  #this is a comment with leading space\ncommand1';
		assert.deepStrictEqual(parseCommands(input), ['command1']);
	});

	test('should handle a complex mix of commands, comments, and empty lines', () => {
		const input = `
			# This is a setup script
			command1 --param value
            
			# Another section
				command2 -f
            
			command3
			# final comment
            
				# indented comment
		`;
		assert.deepStrictEqual(parseCommands(input), [
			'command1 --param value',
			'command2 -f',
			'command3',
		]);
	});

	test('should return an empty array if all lines are comments or empty', () => {
		const input = `
			# comment 1
            
				# comment 2
                 
		`;
		assert.deepStrictEqual(parseCommands(input), []);
	});

	test('should correctly parse commands with internal spaces', () => {
		assert.deepStrictEqual(parseCommands('command with internal spaces'), [
			'command with internal spaces',
		]);
	});

	test('should correctly parse commands with various special characters', () => {
		const command = 'command --option="complex value with spaces & symbols" /path/to/something';
		assert.deepStrictEqual(parseCommands(command), [command]);
	});

	test('should not filter lines that contain # but do not start with it after trimming', () => {
		const input = 'command1 # this is part of the command\n  line with # in middle';
		assert.deepStrictEqual(parseCommands(input), [
			'command1 # this is part of the command',
			'line with # in middle',
		]);
	});

	test('should handle commands separated by mixed newline characters (though split is on \n)', () => {
		// JavaScript's split('\n') handles \r\n by producing an empty string for \r if it's not followed by \n,
		// or just splits by \n. The trim and filter logic should handle this robustly.
		const input = 'command1\r\ncommand2\ncommand3';
		assert.deepStrictEqual(parseCommands(input), ['command1', 'command2', 'command3']);
	});
});
