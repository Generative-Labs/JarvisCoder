/**
 * Telemetry module main entry point
 * 
 * This module provides telemetry and analytics capabilities for the AI Training VSCode extension.
 * It includes event tracking, user analytics, error reporting, and privacy-focused data collection.
 */

import * as vscode from 'vscode';

import { Logger } from '../utils/logger';

export { TelemetryConfigManager } from './config';

// New managers and components
export { TelemetryManager, getTelemetryManager } from './TelemetryManager';
export { VSCodeTelemetry } from './VSCodeTelemetry';
export { PluginTelemetry } from './ExtensionTelemetry';
export { TelemetryUtils } from './utils';
export { EventQueue } from './EventQueue';

export {
  TelemetryEvent,
  TelemetryConfig,
  DeviceInfo,
  TelemetryEventName,
  TELEMETRY_EVENTS
} from './types';

/**
 * Initialize telemetry for the extension
 * Call this in your extension's activate() function
 */
export async function initializeTelemetry(context: vscode.ExtensionContext): Promise<void> {
  const { getTelemetryManager } = await import('./TelemetryManager');
  const telemetryManager = getTelemetryManager();
  await telemetryManager.initialize(context);
}

/**
 * Quick track event function for convenience
 * Adds events to batch queue for efficient sending
 */
export async function trackEvent(
  eventName: string, 
  properties?: Record<string, any>
): Promise<void> {
  try {
    // Filter: Only track specific events
    const allowedEvents = [
      // Workspace events
      'WORKSPACE_OPENED',
      'WORKSPACE_CHANGED',
      // Authentication events  
      'AUTH_STARTED',
      'USER_LOGOUT',
      // LLM interaction events
      'CHAT_MESSAGE_SENT'
    ];
    
    if (!allowedEvents.includes(eventName)) {
      // Silently filter out non-essential events
      return;
    }

    const { TelemetryConfigManager } = await import('./config');
    const { TelemetryUtils } = await import('./utils');
    const { EventQueue } = await import('./EventQueue');
    
    // Check if telemetry is enabled
    if (!TelemetryConfigManager.isEnabled()) {
      return;
    }

    const config = TelemetryConfigManager.getConfig();
    const gaTrackingId = config.gaTrackingId;

    // Debug mode - just log
    if (config.debugMode) {
      Logger.debug(`Telemetry Event: ${eventName} - ${JSON.stringify(properties)}`);
      return;
    }

    // Skip if no GA tracking ID configured
    if (!gaTrackingId) {
      Logger.info(`Telemetry Event: ${eventName} - ${JSON.stringify(properties)}`);
      return;
    }

    // Get current extension context (simplified approach)
    const deviceInfo = TelemetryUtils.getDeviceInfo();
    const region = await TelemetryUtils.getRegion();
    
    // Get current user ID from auth service, fallback to anonymous
    const userIdFromAuth = await getCurrentUserId();
    const userId = userIdFromAuth || await getAnonymousUserId();

    // Get current chat session ID if available (plugin-level session)
    const chatSessionId = await getCurrentChatSessionId();

    // Create telemetry event
    const telemetryEvent = {
      event: eventName,
      timestamp: new Date().toISOString(),
      user_id: userId,
      session_id: chatSessionId || 'none',
      version: deviceInfo.extensionVersion,
      platform: deviceInfo.platform,
      os_locale: deviceInfo.osLocale,
      timezone: deviceInfo.timezone,
      region: region,
      properties: sanitizeGA4Properties(properties || {})
    };

    // Add to batch queue instead of sending immediately
    const eventQueue = EventQueue.getInstance();
    eventQueue.enqueue(telemetryEvent);

  } catch (error) {
    // Silently fail to avoid breaking extension functionality
    Logger.warn(`Failed to track telemetry event: ${String(error)}`);
  }
}

/**
 * Quick track error function for convenience
 */
export async function trackError(
  errorType: 'RUNTIME' | 'API' | 'EXTENSION',
  error: Error,
  context?: Record<string, any>
): Promise<void> {
  try {
    // Track error as a special event
    await trackEvent(`ERROR_${errorType}`, {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack?.substring(0, 500), // Limit stack trace length
      ...context
    });
  } catch (trackingError) {
    // Silently fail to avoid breaking extension functionality
    Logger.warn(`Failed to track error: ${String(trackingError)}`);
  }
}

/**
 * Force flush all queued events immediately
 */
export async function flushTelemetry(): Promise<void> {
  try {
    const { EventQueue } = await import('./EventQueue');
    const eventQueue = EventQueue.getInstance();
    await eventQueue.flush();
  } catch (error) {
    Logger.warn(`Failed to flush telemetry: ${String(error)}`);
  }
}

/**
 * Get telemetry queue status for debugging
 */
export async function getTelemetryStatus(): Promise<{
  queueSize: number;
  retryQueueSize: number;
  isProcessing: boolean;
  hasTimer: boolean;
}> {
  try {
    const { EventQueue } = await import('./EventQueue');
    const eventQueue = EventQueue.getInstance();
    return eventQueue.getStatus();
  } catch (error) {
    Logger.warn(`Failed to get telemetry status: ${String(error)}`);
    return {
      queueSize: 0,
      retryQueueSize: 0,
      isProcessing: false,
      hasTimer: false
    };
  }
}



/**
 * Sanitize properties for GA4 (parameter names and values have restrictions)
 */
function sanitizeGA4Properties(properties: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(properties)) {
    // GA4 parameter name requirements: max 40 characters, alphanumeric and underscore only
    const sanitizedKey = key.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 40);
    
    // GA4 parameter value requirements
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = value.substring(0, 100); // Max 100 characters
    } else if (typeof value === 'number') {
      sanitized[sanitizedKey] = value;
    } else if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else {
      sanitized[sanitizedKey] = String(value).substring(0, 100);
    }
  }
  
  return sanitized;
}

/**
 * Get anonymous but persistent user ID
 */
async function getAnonymousUserId(): Promise<string> {
  try {
    // Try to get stored user ID from global state
    const extension = vscode.extensions.getExtension('s3-ai.ai-training');
    if (extension && extension.isActive) {
      // Extension is active, we can access context through TelemetryUtils
      // For now, create a simple anonymous ID based on machine ID
      const machineId = vscode.env.machineId;
      return `anon-${machineId.substring(0, 8)}-${machineId.substring(24, 32)}`;
    }
    
    // Fallback: create ID based on machine ID only
    return `anon-${vscode.env.machineId.substring(0, 12)}`;
  } catch (_) {
    // Ultimate fallback: random but it won't be persistent across sessions
    return `anon-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * Get current chat session ID from the active chat
 */
async function getCurrentChatSessionId(): Promise<string | undefined> {
  try {
    const extension = vscode.extensions.getExtension('s3-ai.ai-training');
    if (!extension || !extension.isActive) {
      return undefined;
    }

    // Get the extension context from the activation promise
    const context = extension.exports?.context;
    if (!context) {
      return undefined;
    }

    // Access ChatStateService to get the active chat
    const { ChatStateService } = await import('../providers/services/chatStateService');
    const chatStateService = ChatStateService.getInstance(context);
    const activeChat = await chatStateService.getActiveChat();
    
    return activeChat?.sessionId;
  } catch (error) {
    // Silently fail - we don't want telemetry to break functionality
    Logger.warn(`Failed to get current chat session ID: ${String(error)}`);
    return undefined;
  }
}

/**
 * Get current user ID from auth service
 */
async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const extension = vscode.extensions.getExtension('s3-ai.ai-training');
    if (!extension || !extension.isActive) {
      return undefined;
    }

    // Get the extension context
    const context = extension.exports?.context;
    if (!context) {
      return undefined;
    }

    // Access AuthStateService to get user info
    const { AuthStateService } = await import('../providers/services/authStateService');
    const authStateService = AuthStateService.getInstance(context);
    const userInfo = authStateService.getUserInfo();
    
    return userInfo?.uuid;
  } catch (error) {
    // Silently fail - we don't want telemetry to break functionality
    Logger.warn(`Failed to get current user ID: ${String(error)}`);
    return undefined;
  }
} 