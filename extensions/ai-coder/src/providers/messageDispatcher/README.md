# Message Dispatcher Architecture (Message Dispatcher Pattern) 🚀

## 🎯 Design Goals

Refactor the huge original switch case into an elegant **dispatch & handler pattern**, supporting
middleware mechanism to achieve separation of concerns and extensibility.

## 🏗️ Architecture Overview

```
WebView Message → MessageDispatcher → [Middleware Chain] → Specific Handler
                                   ↓
                              TelemetryMiddleware (Auto tracking)
                              LoggingMiddleware (Optional)
                              PerformanceMiddleware (Optional)
```

## 📁 File Structure

```
src/providers/messageDispatcher/
├── MessageDispatcher.ts          # Core dispatcher
├── MessageDispatcherFactory.ts   # Factory function
├── types.ts                      # Type definitions
├── handlers/                     # Message handlers
│   ├── index.ts
│   ├── TerminalHandler.ts
│   ├── ThemeHandler.ts
│   ├── AuthHandler.ts
│   ├── UserInfoHandler.ts
│   ├── TokenHandler.ts
│   ├── CodeDiffHandler.ts
│   ├── ChatHandler.ts
│   ├── FileHandler.ts
│   └── CodeContextHandler.ts
├── middlewares/                  # Middlewares
│   └── TelemetryMiddleware.ts
└── README.md
```

## 🔧 Core Components

### 1. MessageDispatcher

Core class responsible for message dispatching and middleware execution:

```typescript
const dispatcher = new MessageDispatcher({
	enableMiddlewares: true,
	logUnhandledMessages: true,
	timeout: 30000,
});

// Register middleware
dispatcher.use(createTelemetryMiddleware());

// Register handlers
dispatcher.register(EventMessage.OPEN_NEW_CHAT, new ChatHandler());

// Dispatch message
await dispatcher.dispatch(messageData, chatViewProvider);
```

### 2. MessageHandler Interface

Each specific message handler implements this interface:

```typescript
interface MessageHandler {
	handle(data: MessageData, context: MessageContext): Promise<void>;
}
```

### 3. Middleware Pattern

Middleware can insert logic before and after handler execution:

```typescript
type Middleware = (
	data: MessageData,
	context: MessageContext,
	next: () => Promise<void>,
) => Promise<void>;
```

## 📋 Event Handling Mapping

| Event Type                                                   | Handler            | Description                |
| ------------------------------------------------------------ | ------------------ | -------------------------- |
| `OPEN_IN_TERMINAL`                                           | TerminalHandler    | Terminal command execution |
| `REQUEST_THEME`                                              | ThemeHandler       | Theme information request  |
| `START_AUTH`, `LOGOUT`, `REFRESH_TOKEN_EXPIRED`              | AuthHandler        | Authentication related     |
| `GET_USER_INFO`                                              | UserInfoHandler    | User information retrieval |
| `GET_TOKEN_INFO`, `SAVE_TOKEN_INFO`                          | TokenHandler       | Token management           |
| `SHOW_CODE_DIFF`, `ACCEPT_ALL_CHANGES`, `REJECT_ALL_CHANGES` | CodeDiffHandler    | Code diff operations       |
| `GET_CHATS`, `OPEN_NEW_CHAT`, `DELETE_CHAT`, etc.            | ChatHandler        | Chat management            |
| `OPEN_FILE_AND_SELECT`                                       | FileHandler        | File operations            |
| `CLEAR_CODE_CONTEXT`                                         | CodeContextHandler | Code context management    |

## 🎯 Telemetry Middleware

Automatically adds tracking for all webview messages:

```typescript
export const createTelemetryMiddleware = (): Middleware => {
	return async (data, context, next) => {
		const startTime = Date.now();

		try {
			await next(); // Execute handler

			// Success tracking
			await trackMessageEvent(data, context, {
				success: true,
				duration: Date.now() - startTime,
			});
		} catch (error) {
			// Error tracking
			await trackMessageEvent(data, context, {
				success: false,
				duration: Date.now() - startTime,
				error: error.message,
			});
			throw error;
		}
	};
};
```

## ✨ Advantages

### 🎯 **Separation of Concerns**

- Each handler is only responsible for specific types of messages
- Middleware independently handles cross-cutting concerns (telemetry, logging, etc.)
- Dispatcher only handles routing logic

### 🔧 **Extensibility**

- Adding new message types only requires creating new handlers
- Adding new cross-cutting features only requires creating new middleware
- No need to modify existing code

### 🧪 **Testability**

- Each handler can be tested independently
- Middleware can be tested independently
- Dispatcher logic is clear and easy to test

### 📊 **Automated Tracking**

- Telemetry middleware automatically tracks all messages
- No need to manually add tracking code in business logic
- Unified error handling and performance monitoring

## 🚀 Usage Examples

### Adding a New Handler

```typescript
// 1. Create handler
export class NewFeatureHandler implements MessageHandler {
	async handle(data: MessageData, context: MessageContext): Promise<void> {
		// Handle logic
	}
}

// 2. Register in factory function
dispatcher.registerMany({
	[EventMessage.NEW_FEATURE]: new NewFeatureHandler(),
	// ... other handlers
});
```

### Adding a New Middleware

```typescript
// 1. Create middleware
export const createLoggingMiddleware = (): Middleware => {
	return async (data, context, next) => {
		console.log(`Processing: ${data.type}`);
		await next();
		console.log(`Completed: ${data.type}`);
	};
};

// 2. Register middleware
dispatcher.use(createLoggingMiddleware());
```

## 🎉 Summary

Through the **dispatch & handler pattern**, we achieved:

1. ✅ **Zero-intrusion telemetry** - Middleware automatically tracks, keeping business code clean
2. ✅ **Modular architecture** - Each feature is independent, easy to maintain and test
3. ✅ **Extensible design** - Easy to add new features and new cross-cutting concerns
4. ✅ **Performance monitoring** - Automatically track processing time and error rates
5. ✅ **Type safety** - Complete TypeScript support

This architecture not only solves the code bloat problem but also lays a solid foundation for future
feature expansion! 🎯
