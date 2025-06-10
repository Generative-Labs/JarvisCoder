import * as os from 'os';

import * as vscode from 'vscode';

import { DeviceInfo } from './types';
import { Logger } from '../utils/logger';

/**
 * Telemetry utility functions
 */
export class TelemetryUtils {
  private static cachedRegion: string | null = null;

  /**
   * Get device and environment information
   */
  public static getDeviceInfo(): DeviceInfo {
    const platform = this.getPlatformString();
    const osLocale = vscode.env.language || 'en-US';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const vsCodeVersion = vscode.version;
    
    // Get extension version from package.json
    const extensionVersion = vscode.extensions.getExtension('s3-ai.ai-training')?.packageJSON?.version || 'unknown';

    return {
      platform,
      osLocale,
      timezone,
      vsCodeVersion,
      extensionVersion
    };
  }

  /**
   * Get platform string in the format: os_arch
   */
  private static getPlatformString(): string {
    const platform = os.platform();
    const arch = os.arch();
    return `${platform}_${arch}`;
  }

  /**
   * Get region information using IP geolocation
   */
  public static async getRegion(): Promise<string | undefined> {
    try {
      // Check cache first (avoid repeated API calls)
      if (this.cachedRegion) {
        return this.cachedRegion;
      }

      // Use ipapi.co for free IP geolocation (no API key required)
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'User-Agent': 'VSCode-AI-Training-Extension'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Format: Country-Region (e.g., "CN-Zhejiang", "US-California")
      const region = data.country_code && data.region 
        ? `${data.country_code}-${data.region}`
        : data.country_code || undefined;

      // Cache the result for this session
      this.cachedRegion = region;
      
      return region;
    } catch (error) {
      // Silently fail and return undefined - we don't want to break functionality
      Logger.warn(`Failed to get region info: ${String(error)}`);
      return undefined;
    }
  }
} 