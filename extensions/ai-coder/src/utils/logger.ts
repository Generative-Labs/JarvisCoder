import type { OutputChannel } from 'vscode';

/**
 * Simple logging utility for the extension's backend code.
 * Uses VS Code's OutputChannel which must be initialized from extension.ts
 * to ensure proper registration with the extension context.
 */
export class Logger {
	private static outputChannel: OutputChannel;

	/**
	 * Initialize the logger with a VS Code OutputChannel
	 * @param {OutputChannel} outputChannel - The VS Code OutputChannel to use for logging
	 */
	static initialize(outputChannel: OutputChannel): void {
		Logger.outputChannel = outputChannel;
	}

	/**
	 * Log an error message and optional exception
	 * @param {string} message - The error message to log
	 * @param {Error} [error] - Optional error object to log
	 */
	static error(message: string, error?: Error): void {
		const logMessage = `ERROR: ${message}`;
		Logger.outputChannel?.appendLine(logMessage);
		if (error) {
			Logger.outputChannel?.appendLine(error.stack || error.message);
		}
	}

	/**
	 * Log a warning message
	 * @param {string} message - The warning message to log
	 */
	static warn(message: string): void {
		Logger.outputChannel?.appendLine(`WARN: ${message}`);
	}

	/**
	 * Log an informational message
	 * @param {string} message - The message to log
	 */
	static info(message: string): void {
		Logger.outputChannel?.appendLine(`INFO: ${message}`);
	}

	/**
	 * Log a debug message
	 * @param {string} message - The debug message to log
	 */
	static debug(message: string): void {
		if (process.env.NODE_ENV === 'development') {
			Logger.outputChannel?.appendLine(`DEBUG: ${message}`);
		}
	}

	/**
	 * Log a trace message (most verbose level)
	 * @param {string} message - The trace message to log
	 */
	static trace(message: string): void {
		if (process.env.NODE_ENV === 'development') {
			Logger.outputChannel?.appendLine(`TRACE: ${message}`);
		}
	}
}

/**
 * Global logger instance that needs to be initialized with an OutputChannel
 * from the extension's activation function.
 */
export const logger = Logger;
