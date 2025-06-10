# Telemetry Module

Privacy-friendly user behavior analytics and error tracking module for AI Training VSCode Extension.

## 🎯 Features

- **Event Tracking**: Record user actions and extension behaviors
- **Error Reporting**: Automatic error collection and reporting
- **Privacy Protection**: Sensitive data filtering and user anonymization
- **Batch Processing**: Smart event queuing with configurable batch size and intervals
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Offline Support**: Local caching when offline, automatic upload when online
- **Configurable**: User-controllable telemetry switches

## 📊 Data Structure

Each telemetry event contains the following fields:

| Field | Description | Example |
|------|------|------|
| event | Event name | AI_CODER_EXECUTE |
| timestamp | Event occurrence time (ISO) | 2024-06-07T12:00:01Z |
| user_id | Anonymous user ID | anon-001 |
| session_id | Session ID | sess-xxx |
| version | Extension version | v0.0.6 |
| platform | Operating system platform | darwin_arm64 |
| os_locale | System language | zh-CN |
| timezone | Timezone | Asia/Shanghai |
| properties | Event custom properties | {"fileType":"js","success":true} |
| region | Region (optional) | CN-Zhejiang |

## 🚀 Usage

### 1. Initialize (in extension.ts)

```typescript
import { initializeTelemetry } from './telemetry';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize telemetry service
  await initializeTelemetry(context);
  
  // ... other initialization code
}
```

### 2. Track Events

```typescript
import { trackEvent, TELEMETRY_EVENTS, flushTelemetry, getTelemetryStatus } from './telemetry';

// Basic event tracking (automatically batched)
await trackEvent(TELEMETRY_EVENTS.AI_CODER_EXECUTE, {
  fileType: 'javascript',
  success: true,
  duration: 1250
});

// Force immediate flush of all queued events
await flushTelemetry();

// Check queue status
const status = await getTelemetryStatus();
console.log(`Queue: ${status.queueSize}, Processing: ${status.isProcessing}`);
```

### 3. Error Tracking

```typescript
import { trackError } from './telemetry';

try {
  // Code that might error
} catch (error) {
  await trackError('RUNTIME', error, {
    context: 'user_action',
    additional_info: 'some context'
  });
}
```

### 4. Predefined Event Types

```typescript
import { TELEMETRY_EVENTS } from './telemetry';

// Extension lifecycle
TELEMETRY_EVENTS.EXTENSION_ACTIVATED
TELEMETRY_EVENTS.EXTENSION_DEACTIVATED
TELEMETRY_EVENTS.SESSION_START
TELEMETRY_EVENTS.SESSION_END

// AI/Chat related
TELEMETRY_EVENTS.AI_CODER_EXECUTE
TELEMETRY_EVENTS.CHAT_MESSAGE_SENT
TELEMETRY_EVENTS.CHAT_HISTORY_VIEWED
TELEMETRY_EVENTS.NEW_CHAT_CREATED

// File operations
TELEMETRY_EVENTS.FILE_OPEN
TELEMETRY_EVENTS.FILE_SELECTION_ADDED
TELEMETRY_EVENTS.CODE_INDEXED

// Command execution
TELEMETRY_EVENTS.COMMAND_EXECUTED
TELEMETRY_EVENTS.WEBVIEW_OPENED

// Error types
TELEMETRY_EVENTS.ERROR_RUNTIME
TELEMETRY_EVENTS.API_ERROR
TELEMETRY_EVENTS.EXTENSION_ERROR
```

## ⚙️ Configuration Options

Users can configure telemetry behavior in VSCode settings:

```json
{
  "ai-training.telemetry.enabled": true,
  "ai-training.telemetry.batchSize": 10,
  "ai-training.telemetry.batchInterval": 30000,
  "ai-training.telemetry.debugMode": false
}
```

## 🔐 Privacy Protection

### Data Anonymization
- User ID generated based on machine ID, cannot be linked to personal information
- File paths automatically filtered and truncated
- Sensitive fields (passwords, tokens, etc.) automatically excluded

### Data Filtering
```typescript
// Automatically filtered sensitive keywords
const sensitiveKeys = [
  'password', 'token', 'secret', 'key', 'auth',
  'credential', 'private', 'personal', 'email',
  'phone', 'address', 'ip', 'location'
];
```

### User Control
- Telemetry functionality can be completely disabled
- Debug mode only logs locally, doesn't upload
- Users can clear local cache at any time

## 🛠️ Developer Guide

### Adding New Event Types

1. Add new event in the enum in `types.ts`:
```typescript
export enum TELEMETRY_EVENTS {
  // ... existing events
  YOUR_NEW_EVENT = 'YOUR_NEW_EVENT'
}
```

2. Call tracking in appropriate places:
```typescript
await trackEvent(TELEMETRY_EVENTS.YOUR_NEW_EVENT, {
  custom_property: 'value'
});
```

### Debugging Telemetry

Enable debug mode to see event data:
```json
{
  "ai-training.telemetry.debugMode": true
}
```

This will display event details in the output panel without sending to server.

## 📈 Analytics Dimensions

### Google Analytics Custom Dimension Mapping
- cd1: Extension version
- cd2: Operating system platform  
- cd3: System language
- cd4: Timezone
- cd5+: Event properties (string type)

### Custom Metrics Mapping
- cm1+: Event properties (numeric and boolean types)

## 🔧 Google Analytics Configuration

**Security Enhancement: Hard-coded Configuration**

GA Tracking ID and API Secret are now hard-coded in the source code for security:

```typescript
// In TelemetryConfigManager.getConfig()
gaTrackingId: 'G-QXWP33PH2E', // Hard-coded, not user configurable
gaApiSecret: '8yvwO1DwT1OSiFNP7Yw3NA', // Hard-coded, not user configurable
```

This ensures:
- ✅ No hardcoded tracking IDs or secrets exposed to users
- ✅ Input validation and format checking
- ✅ Telemetry data sent to correct analytics account
- ✅ Graceful degradation on configuration errors
- ✅ No sensitive information in logs

## 📊 Monitoring and Debugging

### View Queue Status
```typescript
import { getTelemetryService } from './telemetry';

const service = getTelemetryService();
console.log('Queue size:', service.getQueueSize());
console.log('Context:', service.getTelemetryContext());
```

### Manual Queue Flush
```typescript
await service.flush();
```

## 🤝 Contributing Guidelines

1. Update documentation when adding new events
2. Ensure sensitive data is properly filtered
3. Test both debug mode and normal mode
4. Consider performance impact, avoid high-frequency events

## Architecture Overview

### Dual Telemetry System
This module implements a dual telemetry system:

1. **VSCode Telemetry** (`VSCodeTelemetry.ts`): Monitors VSCode-level events like workspace changes, file operations
2. **Plugin Telemetry** (`ExtensionTelemetry.ts`): Tracks plugin-specific events through middleware pattern

### Key Components
- **TelemetryManager**: Central orchestrator managing both telemetry systems
- **TelemetryConfigManager**: Configuration management with hard-coded GA settings
- **EventQueue**: Smart batching system with retry logic and exponential backoff
- **Event Filtering**: Centralized filtering allows only specific whitelisted events
- **Privacy Protection**: Home directory path anonymization and sensitive data filtering

### Batch Processing System
- **Queue Management**: Events are automatically queued and batched for efficiency
- **Smart Flushing**: Batches sent when size limit reached or timer expires
- **Retry Logic**: Failed batches are retried with exponential backoff (max 3 attempts)
- **Graceful Degradation**: Network failures don't break extension functionality

### Filtered Events
Only these events are tracked:
- `WORKSPACE_OPENED` & `WORKSPACE_CHANGED`
- `AUTH_STARTED` & `USER_LOGOUT`  
- `SEND_MESSAGE_TO_LLM` (user messages to LLM)

---

**Note**: Telemetry data collection strictly follows privacy principles and does not collect any personally identifiable information. 