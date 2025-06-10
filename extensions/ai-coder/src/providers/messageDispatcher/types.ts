import * as vscode from 'vscode';

import { EventMessage } from '../chatEventMessage';

/**
 * Message data interface
 */
export interface MessageData {
  type: EventMessage;
  value: string | number | boolean | object | Array<string | number | boolean | object>;
}

/**
 * Message processing context
 */
export interface MessageContext {
  chatViewProvider?: any; // Avoid circular reference, using any (will be deprecated)
  webview?: vscode.Webview; // For sending messages back to webview
  timestamp: number;
  requestId: string;
  context?: vscode.ExtensionContext; // Extension context for accessing global state
}

/**
 * Message handler interface
 */
export interface MessageHandler {
  handle(data: MessageData, context: MessageContext): Promise<void>;
}

/**
 * Middleware function type
 */
export type Middleware = (
  data: MessageData,
  context: MessageContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Message dispatcher configuration
 */
export interface DispatcherConfig {
  enableMiddlewares?: boolean;
  logUnhandledMessages?: boolean;
  timeout?: number; // Processing timeout in milliseconds
} 