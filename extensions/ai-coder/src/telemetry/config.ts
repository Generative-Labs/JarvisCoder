import * as vscode from 'vscode';

import { TelemetryConfig } from './types';

/**
 * Telemetry configuration manager
 */
export class TelemetryConfigManager {
  private static readonly CONFIG_SECTION = 'ai-training.telemetry';
  private static readonly DEFAULT_CONFIG: TelemetryConfig = {
    enabled: true,
    batchSize: 10,
    batchInterval: 30000, // 30 seconds
    debugMode: false
  };

  /**
   * Get current telemetry configuration
   */
  public static getConfig(): TelemetryConfig {
    const config = vscode.workspace.getConfiguration();
    
    return {
      enabled: config.get(`${this.CONFIG_SECTION}.enabled`, this.DEFAULT_CONFIG.enabled),
      gaTrackingId: 'G-QXWP33PH2E', // Hard-coded, not user configurable
      gaApiSecret: '8yvwO1DwT1OSiFNP7Yw3NA', // Hard-coded, not user configurable
      batchSize: config.get(`${this.CONFIG_SECTION}.batchSize`, this.DEFAULT_CONFIG.batchSize),
      batchInterval: config.get(`${this.CONFIG_SECTION}.batchInterval`, this.DEFAULT_CONFIG.batchInterval),
      debugMode: config.get(`${this.CONFIG_SECTION}.debugMode`, this.DEFAULT_CONFIG.debugMode)
    };
  }

  /**
   * Check if telemetry is enabled
   */
  public static isEnabled(): boolean {
    return this.getConfig().enabled;
  }

  /**
   * Update telemetry enabled status
   */
  public static async setEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    await config.update(`${this.CONFIG_SECTION}.enabled`, enabled, vscode.ConfigurationTarget.Global);
  }

  /**
   * Listen to configuration changes
   */
  public static onConfigurationChanged(callback: (config: TelemetryConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.CONFIG_SECTION)) {
        callback(this.getConfig());
      }
    });
  }
} 