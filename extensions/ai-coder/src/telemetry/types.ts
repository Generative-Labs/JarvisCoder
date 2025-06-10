/**
 * Telemetry types and interfaces
 */

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  user_id: string;
  session_id: string;
  version: string;
  platform: string;
  os_locale: string;
  timezone: string;
  properties: Record<string, any>;
  region?: string;
}



export interface TelemetryConfig {
  enabled: boolean;
  gaTrackingId?: string;
  gaApiSecret?: string;
  batchSize: number;
  batchInterval: number; // milliseconds
  debugMode: boolean;
}

export interface DeviceInfo {
  platform: string;
  osLocale: string;
  timezone: string;
  vsCodeVersion: string;
  extensionVersion: string;
}

/**
 * Telemetry event enumeration
 */
export enum TELEMETRY_EVENTS {
  // Extension lifecycle
  EXTENSION_ACTIVATED = 'EXTENSION_ACTIVATED',
  EXTENSION_DEACTIVATED = 'EXTENSION_DEACTIVATED',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',
  
  // AI/Chat related
  AI_CODER_EXECUTE = 'AI_CODER_EXECUTE',
  CHAT_MESSAGE_SENT = 'CHAT_MESSAGE_SENT',
  CHAT_HISTORY_VIEWED = 'CHAT_HISTORY_VIEWED',
  NEW_CHAT_CREATED = 'NEW_CHAT_CREATED',
  
  // File operations
  FILE_OPEN = 'FILE_OPEN',
  FILE_SELECTION_ADDED = 'FILE_SELECTION_ADDED',
  CODE_INDEXED = 'CODE_INDEXED',
  
  // Workspace operations
  WORKSPACE_OPENED = 'WORKSPACE_OPENED',
  WORKSPACE_CHANGED = 'WORKSPACE_CHANGED',
  
  // Commands
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  WEBVIEW_OPENED = 'WEBVIEW_OPENED',
  
  // Errors
  ERROR_RUNTIME = 'ERROR_RUNTIME',
  API_ERROR = 'API_ERROR',
  EXTENSION_ERROR = 'EXTENSION_ERROR',
  
  // Webview message events
  WEBVIEW_MESSAGE_RECEIVED = 'WEBVIEW_MESSAGE_RECEIVED',
  WEBVIEW_MESSAGE_SENT = 'WEBVIEW_MESSAGE_SENT',
  
  // Specific business events
  CHAT_DELETED = 'CHAT_DELETED',
  CHAT_SWITCHED = 'CHAT_SWITCHED',
  CHAT_TITLE_UPDATED = 'CHAT_TITLE_UPDATED',
  CODE_DIFF_VIEWED = 'CODE_DIFF_VIEWED',
  CODE_CHANGES_ACCEPTED = 'CODE_CHANGES_ACCEPTED',
  CODE_CHANGES_REJECTED = 'CODE_CHANGES_REJECTED',
  FILE_OPENED_FROM_WEBVIEW = 'FILE_OPENED_FROM_WEBVIEW',
  CODE_CONTEXT_CLEARED = 'CODE_CONTEXT_CLEARED',
  TERMINAL_COMMAND_EXECUTED = 'TERMINAL_COMMAND_EXECUTED',
  AUTH_STARTED = 'AUTH_STARTED',
  USER_LOGOUT = 'USER_LOGOUT'
}

export type TelemetryEventName = TELEMETRY_EVENTS | string; 