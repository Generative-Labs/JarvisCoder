/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TelemetryEvent } from './types';
import { Logger } from '../utils/logger';

/**
 * Event queue manager for batching and buffering telemetry events
 */
export class EventQueue {
	private static instance: EventQueue | null = null;
	private queue: TelemetryEvent[] = [];
	private batchTimer: NodeJS.Timeout | null = null;
	private isProcessing = false;
	private readonly maxRetries = 3;
	private retryQueue: Array<{ events: TelemetryEvent[]; retryCount: number }> = [];

	private constructor() {
		// Private constructor for singleton pattern
	}

	public static getInstance(): EventQueue {
		if (!EventQueue.instance) {
			EventQueue.instance = new EventQueue();
		}
		return EventQueue.instance;
	}

	/**
	 * Add event to the queue
	 */
	public enqueue(event: TelemetryEvent): void {
		this.queue.push(event);
		Logger.debug(`Event queued: ${event.event} (queue size: ${this.queue.length})`);

		this.scheduleFlush();
	}

	/**
	 * Schedule flush based on configuration
	 */
	private async scheduleFlush(): Promise<void> {
		const { TelemetryConfigManager } = await import('./config');
		const config = TelemetryConfigManager.getConfig();

		// Immediate flush if batch size reached
		if (this.queue.length >= config.batchSize) {
			this.clearTimer();
			await this.flush();
			return;
		}

		// Schedule timer-based flush if not already scheduled
		if (!this.batchTimer) {
			this.batchTimer = setTimeout(async () => {
				await this.flush();
			}, config.batchInterval);
		}
	}

	/**
	 * Force flush all queued events
	 */
	public async flush(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;
		this.clearTimer();

		const eventsToSend = [...this.queue];
		this.queue = [];

		try {
			await this.sendBatch(eventsToSend);
			// allow-any-unicode-next-line
			Logger.info(`Batch sent successfully: ${eventsToSend.length} events`);
		} catch (error) {
			Logger.warn(`Failed to send batch: ${String(error)}`);
			// Add to retry queue
			this.retryQueue.push({ events: eventsToSend, retryCount: 0 });
			this.scheduleRetry();
		} finally {
			this.isProcessing = false;
		}

		// Process retry queue
		await this.processRetries();
	}

	/**
	 * Send a batch of events to GA4
	 */
	private async sendBatch(events: TelemetryEvent[]): Promise<void> {
		if (events.length === 0) {
			return;
		}

		const { TelemetryConfigManager } = await import('./config');
		const config = TelemetryConfigManager.getConfig();

		// Debug mode - just log
		if (config.debugMode) {
			Logger.debug(`Debug batch: ${events.length} events\n${JSON.stringify(events, null, 2)}`);
			return;
		}

		// Validate GA credentials to prevent URL injection
		if (!config.gaTrackingId || !config.gaApiSecret) {
			throw new Error('GA tracking configuration missing');
		}

		// Validate format to prevent injection
		if (!/^G-[A-Z0-9]{10}$/.test(config.gaTrackingId)) {
			throw new Error('Invalid GA tracking ID format');
		}

		if (!/^[A-Za-z0-9_-]{22}$/.test(config.gaApiSecret)) {
			throw new Error('Invalid GA API secret format');
		}

		const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.gaTrackingId)}&api_secret=${encodeURIComponent(config.gaApiSecret)}`;

		// Group events by client_id for GA4 batch format
		const eventsByClient = this.groupEventsByClient(events);

		// Send each client's events as a separate request (GA4 limitation)
		for (const [clientId, clientEvents] of Array.from(eventsByClient.entries())) {
			await this.sendClientBatch(url, clientId, clientEvents);
		}
	}

	/**
	 * Group events by client ID for GA4 batch format
	 */
	private groupEventsByClient(events: TelemetryEvent[]): Map<string, TelemetryEvent[]> {
		const grouped = new Map<string, TelemetryEvent[]>();

		for (const event of events) {
			const clientId = event.user_id;
			if (!grouped.has(clientId)) {
				grouped.set(clientId, []);
			}
			grouped.get(clientId)?.push(event);
		}

		return grouped;
	}

	/**
	 * Send events for a single client to GA4
	 */
	private async sendClientBatch(
		url: string,
		clientId: string,
		events: TelemetryEvent[],
	): Promise<void> {
		const axios = await import('axios');

		// Get VSCode version for all events
		const vscode = await import('vscode');
		const vsCodeVersion = vscode.version;

		const payload = {
			client_id: clientId,
			events: events.map((event) => ({
				name: event.event.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
				params: {
					// Core telemetry fields
					chat_session_id: event.session_id,
					version: event.version,
					platform: event.platform,
					os_locale: event.os_locale,
					timezone: event.timezone,
					vscode_version: vsCodeVersion,
					region: event.region || 'unknown',

					// Event-specific properties
					...event.properties,

					// Add timestamp as parameter
					event_timestamp: event.timestamp,
				},
			})),
		};

		const response = await axios.default.post(url, payload, {
			headers: {
				'Content-Type': 'application/json',
			},
			timeout: 10000, // 10 second timeout for batch requests
		});

		if (response.status !== 204) {
			throw new Error(`GA4 API returned status ${response.status}`);
		}

		Logger.debug(`Batch sent for client ${clientId.substring(0, 8)}...: ${events.length} events`);
	}

	/**
	 * Process retry queue
	 */
	private async processRetries(): Promise<void> {
		const retryItems = [...this.retryQueue];
		this.retryQueue = [];

		for (const item of retryItems) {
			if (item.retryCount < this.maxRetries) {
				try {
					await this.sendBatch(item.events);
					Logger.info(`Retry successful: ${item.events.length} events (attempt ${item.retryCount + 1})`);
				} catch (error) {
					Logger.warn(`Retry failed (attempt ${item.retryCount + 1}): ${String(error)}`);
					item.retryCount++;
					this.retryQueue.push(item);
				}
			} else {
				Logger.error(`Max retries exceeded for batch: ${item.events.length} events discarded`);
			}
		}
	}

	/**
	 * Schedule retry with exponential backoff
	 */
	private scheduleRetry(): void {
		const delay = Math.min(1000 * Math.pow(2, this.retryQueue.length), 30000); // Max 30 seconds

		setTimeout(async () => {
			await this.processRetries();
		}, delay);
	}

	/**
	 * Clear the batch timer
	 */
	private clearTimer(): void {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}
	}

	/**
	 * Get queue status
	 */
	public getStatus(): {
		queueSize: number;
		retryQueueSize: number;
		isProcessing: boolean;
		hasTimer: boolean;
	} {
		return {
			queueSize: this.queue.length,
			retryQueueSize: this.retryQueue.length,
			isProcessing: this.isProcessing,
			hasTimer: !!this.batchTimer,
		};
	}

	/**
	 * Clear all queues and timers
	 */
	public dispose(): void {
		this.clearTimer();
		this.queue = [];
		this.retryQueue = [];
		this.isProcessing = false;
		Logger.info('EventQueue disposed');
	}
}
