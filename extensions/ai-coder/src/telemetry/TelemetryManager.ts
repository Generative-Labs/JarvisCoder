/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { PluginTelemetry } from './ExtensionTelemetry';
import { VSCodeTelemetry } from './VSCodeTelemetry';
import { Middleware } from '../providers/messageDispatcher/types';
import { Logger } from '../utils/logger';

/**
 * Telemetry Manager - Unified management of VSCode and Plugin telemetry systems
 */
export class TelemetryManager {
	private static instance: TelemetryManager | null = null;
	private vscodeTelemetry: VSCodeTelemetry | null = null;
	private pluginTelemetry: PluginTelemetry | null = null;
	private isInitialized = false;

	private constructor() {
		// Private constructor for singleton pattern
	}

	public static getInstance(): TelemetryManager {
		if (!TelemetryManager.instance) {
			TelemetryManager.instance = new TelemetryManager();
		}
		return TelemetryManager.instance;
	}

	/**
	 * Initialize telemetry system
	 */
	public async initialize(context: vscode.ExtensionContext): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// 1. Initialize VSCode event monitoring
			this.vscodeTelemetry = VSCodeTelemetry.getInstance();
			this.vscodeTelemetry.start(context);

			// 2. Initialize plugin event monitoring
			this.pluginTelemetry = PluginTelemetry.getInstance();
			this.pluginTelemetry.start();

			// 3. Initialize event queue for batching
			const { EventQueue } = await import('./EventQueue');
			EventQueue.getInstance(); // Ensure singleton is created

			this.isInitialized = true;
			Logger.info('TelemetryManager initialized successfully');
		} catch (error) {
			Logger.error(
				'Failed to initialize TelemetryManager',
				error instanceof Error ? error : new Error(String(error)),
			);
			throw error;
		}
	}

	/**
	 * Get plugin middleware array
	 * Used for registration in MessageDispatcher
	 */
	public getExtensionMiddlewares(): Middleware[] {
		const middleware = this.pluginTelemetry?.getMiddleware();
		return middleware ? [middleware] : [];
	}

	/**
	 * Get component status
	 */
	public getStatus(): {
		vscodeTelemetry: boolean;
		pluginTelemetry: boolean;
		overall: boolean;
	} {
		return {
			vscodeTelemetry: this.vscodeTelemetry?.isRunning() || false,
			pluginTelemetry: this.pluginTelemetry?.isRunning() || false,
			overall: this.isInitialized,
		};
	}

	/**
	 * Enable/disable VSCode telemetry
	 */
	public toggleVSCodeTelemetry(enabled: boolean, context?: vscode.ExtensionContext): void {
		if (enabled && !this.vscodeTelemetry?.isRunning()) {
			if (context) {
				this.vscodeTelemetry?.start(context);
			}
		} else if (!enabled && this.vscodeTelemetry?.isRunning()) {
			this.vscodeTelemetry?.stop();
		}
	}

	/**
	 * Enable/disable Plugin telemetry
	 */
	public toggleExtensionTelemetry(enabled: boolean): void {
		if (enabled && !this.pluginTelemetry?.isRunning()) {
			this.pluginTelemetry?.start();
		} else if (!enabled && this.pluginTelemetry?.isRunning()) {
			this.pluginTelemetry?.stop();
		}
	}

	/**
	 * Clean up all resources
	 */
	public async dispose(): Promise<void> {
		try {
			// Stop VSCode telemetry
			this.vscodeTelemetry?.stop();

			// Stop Plugin telemetry
			this.pluginTelemetry?.stop();

			// Flush and dispose event queue
			const { EventQueue } = await import('./EventQueue');
			const eventQueue = EventQueue.getInstance();
			await eventQueue.flush(); // Send any remaining events
			eventQueue.dispose();

			this.isInitialized = false;
			Logger.info('TelemetryManager disposed successfully');
		} catch (error) {
			Logger.error(
				'Error disposing TelemetryManager',
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}
}

// Convenience function
export function getTelemetryManager(): TelemetryManager {
	return TelemetryManager.getInstance();
}
