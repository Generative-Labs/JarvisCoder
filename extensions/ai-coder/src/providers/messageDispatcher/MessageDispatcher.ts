import { Logger } from '../../utils/logger';
import { EventMessage } from '../chatEventMessage';
import { 
  MessageData, 
  MessageContext, 
  MessageHandler, 
  Middleware, 
  DispatcherConfig 
} from './types';

// Context enhancer type
type ContextEnhancer = (data: MessageData, baseContext: MessageContext) => MessageContext;

/**
 * Message dispatcher - responsible for dispatching webview messages to corresponding handlers
 * Supports middleware mechanism for inserting various logic before and after message processing
 */
export class MessageDispatcher {
  private handlers = new Map<EventMessage, MessageHandler>();
  private middlewares: Middleware[] = [];
  private config: DispatcherConfig;
  private contextEnhancer: ContextEnhancer | null = null;

  constructor(config: DispatcherConfig = {}) {
    this.config = {
      enableMiddlewares: true,
      logUnhandledMessages: true,
      timeout: 30000, // 30 seconds timeout
      ...config
    };
  }

  /**
   * Register middleware
   */
  use(middleware: Middleware): void {
    if (!this.config.enableMiddlewares) {
      return;
    }
    this.middlewares.push(middleware);
  }

  /**
   * Set context enhancer
   * Allows custom extension of context before message dispatch
   */
  setContextEnhancer(enhancer: ContextEnhancer): void {
    this.contextEnhancer = enhancer;
  }

  /**
   * Register message handler
   */
  register(type: EventMessage, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register multiple handlers at once
   */
  registerMany(handlers: Partial<Record<EventMessage, MessageHandler>>): void {
    Object.entries(handlers).forEach(([type, handler]) => {
      if (handler) {
        this.register(type as EventMessage, handler);
      }
    });
  }

  /**
   * Dispatch message to corresponding handler
   */
  async dispatch(data: MessageData, chatViewProvider: any): Promise<void> {
    const webview = chatViewProvider._view?.webview;
    
    let context: MessageContext = {
      chatViewProvider,  // Legacy compatibility, will be deprecated
      webview,          // New access method
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    // Use context enhancer to extend context
    if (this.contextEnhancer) {
      context = this.contextEnhancer(data, context);
    }

    try {
      // Execute middleware chain + handler
      await this.executeWithTimeout(
        () => this.executeMiddlewareChain(data, context),
        this.config.timeout || 30000
      );
    } catch (error) {
      Logger.error('Message dispatch error:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Execute middleware chain and final handler
   */
  private async executeMiddlewareChain(data: MessageData, context: MessageContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        // Execute next middleware
        const middleware = this.middlewares[index++];
        await middleware(data, context, next);
      } else {
        // All middleware executed, execute final handler
        await this.executeHandler(data, context);
      }
    };

    await next();
  }

  /**
   * Execute final message handler
   */
  private async executeHandler(data: MessageData, context: MessageContext): Promise<void> {
    const handler = this.handlers.get(data.type);
    
    if (handler) {
      await handler.handle(data, context);
    } else {
      if (this.config.logUnhandledMessages) {
        Logger.warn(`No handler registered for message type: ${data.type}`);
      }
      // Could consider throwing error or having default handling logic
    }
  }

  /**
   * Timeout protection
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Message handling timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get count of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Get count of registered middlewares
   */
  getMiddlewareCount(): number {
    return this.middlewares.length;
  }

  /**
   * Clear all handlers and middlewares (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.middlewares.length = 0;
  }
} 