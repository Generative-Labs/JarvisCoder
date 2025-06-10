/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { logger } from './logger';

/**
 * Type representing a task function that can be queued
 * @typedef {() => Promise<void> | void} Task
 */
type Task = () => Promise<void> | void;

/**
 * A queue that enforces a minimum time interval between task executions
 */
export class RateLimitedQueue {
	/** Queue of tasks to be executed */
	private queue: Task[] = [];

	/** Flag indicating if the queue is currently processing tasks */
	private isProcessing = false;

	/** Minimum interval between task executions in milliseconds */
	private readonly interval: number;

	/**
	 * Creates a new RateLimitedQueue
	 * @param minInterval - Minimum interval between task executions in milliseconds
	 */
	constructor(minInterval: number) {
		this.interval = minInterval;
	}

	/**
	 * Logs an error message
	 * @private
	 * @param message - The error message
	 * @param error - The error object
	 */
	private logError(message: string, error: unknown): void {
		if (error instanceof Error) {
			logger.error(`[RateLimitedQueue] ${message}`, error);
		} else {
			logger.error(`[RateLimitedQueue] ${message}: ${String(error)}`);
		}
	}

	/**
	 * Adds a task to the queue and starts processing if not already running
	 * @param task - The task function to enqueue
	 * @returns
	 */
	public enqueue(task: Task): void {
		this.queue.push(task);
		this.processQueue().catch((error) => {
			this.logError('Error processing queue', error);
		});
	}

	/**
	 * Clears all pending tasks from the queue
	 */
	public clearQueue(): void {
		this.queue = [];
	}

	/**
	 * Gets the current length of the queue
	 * @returns The number of tasks in the queue
	 */
	public getQueueLength(): number {
		return this.queue.length;
	}

	/**
	 * Internal method to process the queue
	 * @private
	 * @returns A promise that resolves when the queue is empty
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;

		try {
			while (this.queue.length > 0) {
				const task = this.queue.shift();
				if (task) {
					try {
						await task();
					} catch (error) {
						// Log the error but continue processing other tasks
						this.logError('Error executing task', error);
					}
				}

				// Wait for the minimum interval before processing the next task
				if (this.queue.length > 0) {
					await new Promise((resolve) => setTimeout(resolve, this.interval));
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}
}
