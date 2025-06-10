import { createTelemetryMiddleware } from '../providers/messageDispatcher/middlewares/TelemetryMiddleware';
import { Middleware } from '../providers/messageDispatcher/types';
import { Logger } from '../utils/logger';

/**
 * Plugin feature event listener - monitors internal plugin business logic
 */
export class PluginTelemetry {
  private static instance: PluginTelemetry | null = null;
  private middleware: Middleware | null = null;
  private isActive = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): PluginTelemetry {
    if (!PluginTelemetry.instance) {
      PluginTelemetry.instance = new PluginTelemetry();
    }
    return PluginTelemetry.instance;
  }

  /**
   * Start plugin event monitoring
   */
  public start(): void {
    if (this.isActive) {
      return;
    }
    try {
      this.middleware = createTelemetryMiddleware();
      this.isActive = true;
      Logger.info('Plugin Telemetry started');
    } catch (error) {
      Logger.error(
        'Failed to start Plugin Telemetry',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get middleware instance
   * Used for registration in MessageDispatcher
   */
  public getMiddleware(): Middleware | null {
    return this.middleware;
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    this.middleware = null;
    this.isActive = false;
    Logger.info('Plugin Telemetry stopped');
  }

  /**
   * Get running status
   */
  public isRunning(): boolean {
    return this.isActive;
  }
}
