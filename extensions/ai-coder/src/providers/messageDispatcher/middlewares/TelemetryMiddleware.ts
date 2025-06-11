/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { trackEvent, TELEMETRY_EVENTS } from '../../../telemetry';
import { EventMessage } from '../../chatEventMessage';
import { MessageData, MessageContext, Middleware } from '../types';

/**
 * Telemetry middleware - automatically tracks webview message events
 */
export const createTelemetryMiddleware =
	(): Middleware =>
		async (data: MessageData, context: MessageContext, next: () => Promise<void>) => {
			const startTime = Date.now();

			try {
				// Execute next middleware or handler
				await next();

				// Track success event
				await trackMessageEvent(data, context, {
					success: true,
					duration: Date.now() - startTime,
				});
			} catch (error) {
				// Track error event
				await trackMessageEvent(data, context, {
					success: false,
					duration: Date.now() - startTime,
					error: error instanceof Error ? error.message : String(error),
				});

				// Re-throw error without interrupting error propagation
				throw error;
			}
		};

/**
 * Track message events
 */
async function trackMessageEvent(
	data: MessageData,
	context: MessageContext,
	metadata: Record<string, any>,
): Promise<void> {
	const eventData = extractEventData(data.type, data.value);

	// General message event
	await trackEvent(TELEMETRY_EVENTS.WEBVIEW_MESSAGE_RECEIVED, {
		message_type: data.type,
		request_id: context.requestId,
		...eventData,
		...metadata,
		source: 'webview_dispatcher',
	});

	// Specific business events
	await trackSpecificEvents(data.type, data.value, metadata);
}

/**
 * Track specific events with specialized tracking
 */
async function trackSpecificEvents(
	type: EventMessage,
	value: any,
	metadata: Record<string, any>,
): Promise<void> {
	switch (type) {
		case EventMessage.OPEN_NEW_CHAT:
			await trackEvent(TELEMETRY_EVENTS.NEW_CHAT_CREATED, {
				session_id: value?.sessionId ? 'has_session_id' : 'no_session_id',
				model_name: value?.modelName ? 'has_model' : 'no_model',
				...metadata,
			});
			break;

		case EventMessage.DELETE_CHAT:
			await trackEvent(TELEMETRY_EVENTS.CHAT_DELETED, {
				chat_id: typeof value === 'string' ? 'has_id' : 'no_id',
				...metadata,
			});
			break;

		case EventMessage.SHOW_CODE_DIFF:
			await trackEvent(TELEMETRY_EVENTS.CODE_DIFF_VIEWED, {
				content_length: typeof value === 'string' ? value.length : 0,
				...metadata,
			});
			break;

		case EventMessage.ACCEPT_ALL_CHANGES:
			await trackEvent(TELEMETRY_EVENTS.CODE_CHANGES_ACCEPTED, {
				content_length: typeof value === 'string' ? value.length : 0,
				...metadata,
			});
			break;

		case EventMessage.REJECT_ALL_CHANGES:
			await trackEvent(TELEMETRY_EVENTS.CODE_CHANGES_REJECTED, {
				content_length: typeof value === 'string' ? value.length : 0,
				...metadata,
			});
			break;

		case EventMessage.OPEN_FILE_AND_SELECT:
			await trackEvent(TELEMETRY_EVENTS.FILE_OPENED_FROM_WEBVIEW, {
				file_path: value?.filePath ? 'has_path' : 'no_path',
				has_line_selection: !!(value?.startLine && value?.endLine),
				line_count: value?.endLine - value?.startLine + 1 || 0,
				...metadata,
			});
			break;

		case EventMessage.CLEAR_CODE_CONTEXT:
			await trackEvent(TELEMETRY_EVENTS.CODE_CONTEXT_CLEARED, {
				...metadata,
			});
			break;

		case EventMessage.OPEN_IN_TERMINAL:
			await trackEvent(TELEMETRY_EVENTS.TERMINAL_COMMAND_EXECUTED, {
				command_length: typeof value === 'string' ? value.length : 0,
				...metadata,
			});
			break;

		case EventMessage.START_AUTH:
			await trackEvent(TELEMETRY_EVENTS.AUTH_STARTED, {
				...metadata,
			});
			break;

		case EventMessage.LOGOUT:
			await trackEvent(TELEMETRY_EVENTS.USER_LOGOUT, {
				...metadata,
			});
			break;

		case EventMessage.SET_ACTIVE_CHAT:
			await trackEvent(TELEMETRY_EVENTS.CHAT_SWITCHED, {
				...metadata,
			});
			break;

		case EventMessage.UPDATE_CHAT_TITLE:
			await trackEvent(TELEMETRY_EVENTS.CHAT_TITLE_UPDATED, {
				title_length: value?.title ? value.title.length : 0,
				...metadata,
			});
			break;

		case EventMessage.SEND_MESSAGE_TO_LLM:
			await trackEvent(TELEMETRY_EVENTS.CHAT_MESSAGE_SENT, {
				message_length: value?.message ? value.message.length : 0,
				session_id: value?.session_id ? 'has_session_id' : 'no_session_id',
				model_name: value?.model_name || 'unknown',
				has_code_context: !!(value?.code_context && value.code_context.length > 0),
				code_context_count: value?.code_context?.length || 0,
				...metadata,
			});
			break;
	}
}

/**
 * Extract useful data from event value (filtering sensitive information)
 */
function extractEventData(_type: EventMessage, value: any): Record<string, any> {
	const data: Record<string, any> = {};

	if (value === null || value === undefined) {
		data.has_value = false;
		return data;
	}

	data.has_value = true;
	data.value_type = typeof value;

	// Extract different data based on event type
	if (typeof value === 'object') {
		data.object_keys_count = Object.keys(value).length;

		// Extract non-sensitive common fields
		if (value.sessionId) {
			data.has_session_id = true;
		}
		if (value.modelName) {
			data.has_model_name = true;
		}
		if (value.title) {
			data.has_title = true;
		}
		if (value.filePath) {
			data.has_file_path = true;
		}
		if (value.startLine !== undefined) {
			data.has_line_selection = true;
		}
	} else if (typeof value === 'string') {
		data.string_length = value.length;
	} else if (typeof value === 'number') {
		data.number_value = value;
	}

	return data;
}
