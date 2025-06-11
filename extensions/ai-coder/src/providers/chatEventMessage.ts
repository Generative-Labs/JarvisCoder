/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum EventMessage {
	START_AUTH = 'start_auth',
	LOGOUT = 'logout',
	OPEN_IN_TERMINAL = 'open_in_terminal',
	GET_USER_INFO = 'get_user_info',
	SAVE_ACTIVE_CHAT_ID = 'save_active_chat_id',
	SHOW_CODE_DIFF = 'show_code_diff',
	ACCEPT_ALL_CHANGES = 'accept_all_changes',
	REJECT_ALL_CHANGES = 'reject_all_changes',
	GET_TOKEN_INFO = 'get_token_info',
	SAVE_TOKEN_INFO = 'save_token_info',
	REFRESH_TOKEN_EXPIRED = 'refresh_token_expired',
	// about chat
	OPEN_NEW_CHAT = 'open_new_chat',
	GET_CHATS = 'get_chats',
	SAVE_CHATS = 'save_chats',
	DELETE_CHAT = 'delete_chat',
	GET_ACTIVE_CHAT = 'get_active_chat',
	SET_ACTIVE_CHAT = 'set_active_chat',
	UPDATE_CHAT_TITLE = 'update_chat_title',
	OPEN_FILE_AND_SELECT = 'openFileAndSelect',
	GET_NO_WORKSPACE_CHATS = 'get_no_workspace_chats',
	MOVE_CHAT_TO_NO_WORKSPACE = 'move_chat_to_no_workspace',
	// code context
	CLEAR_CODE_CONTEXT = 'clear_code_context',
	REQUEST_THEME = 'request_theme',
	// telemetry
	SEND_MESSAGE_TO_LLM = 'send_message_to_llm',
	REQUEST_TOKEN_AND_USER_INFO = 'get_token_and_user_info',
}

export enum EventResponseMessage {
	USER_INFO = 'userInfo',
	CODE_CONTEXT_SELECTION = 'codeContextSelection',
	CLEAR_ALL_STORAGE = 'clearAllStorage',
	TOKEN_INFO = 'tokenInfo',
	CHATS = 'chats',
	ACTIVE_CHAT = 'activeChat',
	ERROR_MESSAGE = 'error_message',
	NEW_CHAT = 'newChat',
	THEME_INFO = 'themeUpdate',
	TOKEN_AND_USER_INFO = 'tokenAndUserInfo',
	NO_WORKSPACE_CHATS = 'noWorkspaceChats',
}
