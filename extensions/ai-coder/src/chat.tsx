/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback, Profiler, useMemo } from 'react';

import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import 'remixicon/fonts/remixicon.css';
import { RiArrowUpLine, RiStopFill } from '@remixicon/react';
import { debounce } from 'lodash';

import Login from './components/auth/Login';
import AllChatsContent from './components/chat/AllChatsConten';
import ChatTitle from './components/chat/ChatTitle';
import ChatWelcomeContent from './components/chat/ChatWelcomeContent';
import MessageList from './components/chat/MessageList';
import ModelSelection from './components/chat/ModelSelection';
import SelectionCodes from './components/chat/SelectionCodes';
import LoadingText from './components/common/LoadingText';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeInfo, useTheme, ThemeProvider } from './contexts/ThemeContext';
import { VSCodeProvider } from './contexts/VSCodeContext';
import { useChats } from './hooks/useChats';
import { useMessages } from './hooks/useMessages';
import { EventMessage, EventResponseMessage } from './providers/chatEventMessage';
import { TokenInfo, UserInfo } from './types/auth';
import { Chat, SelectedTextMessage, SelectedTextMessageValue } from './types/chats';
import { ErrorMessage } from './types/error';
import { RateLimitedQueue } from './utils/RateLimitedQueue';
import { tokenManager } from './utils/tokenManager';
import ErrorHandler from './components/chat/ErrorHandler';
import { useErrorHandler, ErrorHandlerProvider } from './contexts/ErrorHandlerContext';

export interface VSCodeAPI {
	postMessage(message: {
		type: EventMessage;
		value?: string | number | boolean | object | Array<string | number | boolean | object>;
		command?: string;
	}): void;
}

export interface VSCodeResponseMessage {
	type: EventResponseMessage; // Only allow enum values
	value?: unknown;
	command?: string;
}

declare function acquireVsCodeApi(): VSCodeAPI;

// Ensure vscode API is available
let vscode: VSCodeAPI;
try {
	vscode = acquireVsCodeApi();
	console.log('VSCode API initialized');
} catch (error) {
	console.error('Failed to acquire VS Code API:', error);
	// Provide mock objects for debugging in browser
	vscode = {
		postMessage: (message: any) => console.log('Mock postMessage:', message),
	};
}

function onRenderCallback(id: string, phase: string, actualDuration: number): void {
	console.log(`Profiler [${id}] - ${phase} - ${actualDuration} ms`);
}

// Ensure React app is rendered after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	const rootElement = document.getElementById('root');
	if (rootElement) {
		createRoot(rootElement).render(
			<Profiler id="chat" onRender={onRenderCallback}>
				<VSCodeProvider vscode={vscode}>
					<ErrorHandlerProvider>
						<AuthProvider>
							<ThemeProvider>
								<ChatApp />
							</ThemeProvider>
						</AuthProvider>
					</ErrorHandlerProvider>
				</VSCodeProvider>
			</Profiler>,
		);
		console.log('React app rendered to DOM');
	} else {
		console.error('Root element not found');
	}
});

const queue = new RateLimitedQueue(100);

const ChatApp: React.FC = () => {
	const MESSAGES_PER_PAGE = 22;
	const [inputValue, setInputValue] = useState('');
	const [selectionCodes, setSelectionCodes] = useState<Array<SelectedTextMessageValue>>([]);
	const [selectedModel, setSelectedModel] = useState<string>('auto');
	const {
		setUserInfo,
		onTokenExpired,
		isAuthenticated,
		tokenInfo,
		setTokenInfo,
		onUpdateTokenInfo,
		userInfo,
	} = useAuth();

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const {
		handleUpdateChatTitle,
		currentChat,
		setCurrentChat,
		setIsNewChat,
		setChats,
		chats,
		noWorkspaceChats,
		setNoWorkspaceChats,
	} = useChats();
	const { error: chatError, setError } = useErrorHandler();
	const { setThemeInfo } = useTheme();

	const resetForm = useCallback(() => {
		setInputValue('');
		setSelectionCodes([]);
	}, []);

	const {
		messages,
		isLoading,
		currentPage,
		totalPages,
		handleLoadMore,
		resetMessages,
		handleSendMessage,
		handleStopGeneration,
		isTyping,
		isThinking,
		errorMessage,
		lastMessage,
	} = useMessages({
		currentChat,
		perPageSize: MESSAGES_PER_PAGE,
		messagesContainerRef,
		messagesEndRef,
		queue,
		resetForm,
		selectedModel,
		handleUpdateChatTitle,
	});

	const scrollStateRef = useRef({
		currentPage,
		totalPages,
		isLoading,
	});

	// Update ref when dependencies change
	useEffect(() => {
		scrollStateRef.current = {
			currentPage,
			totalPages,
			isLoading,
		};
	}, [currentPage, totalPages, isLoading]);

	const debouncedHandleScroll = useMemo(
		() =>
			debounce((): void => {
				const container = messagesContainerRef.current;
				if (!container) {
					return;
				}

				const { currentPage, totalPages, isLoading } = scrollStateRef.current;
				// Check if the scroll is at the top (distance from the top is less than 100px)
				if (container.scrollTop < 100 && currentPage < totalPages && !isLoading) {
					handleLoadMore();
				}
			}, 150),
		[handleLoadMore, messagesContainerRef], // only depend on the values that really need to be recreated
	);

	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) {
			return;
		}

		container.addEventListener('scroll', debouncedHandleScroll);
		return () => {
			container.removeEventListener('scroll', debouncedHandleScroll);
		};
	}, [debouncedHandleScroll]);

	// update the textarea height
	useEffect(() => {
		if (textareaRef.current) {
			updateTextareaHeight(textareaRef.current);
		}
	}, [inputValue]);

	useEffect(() => {
		// Notify extension that the React app is initialized
		vscode.postMessage({ type: EventMessage.REQUEST_TOKEN_AND_USER_INFO });
		vscode.postMessage({ type: EventMessage.GET_CHATS });
		vscode.postMessage({ type: EventMessage.GET_NO_WORKSPACE_CHATS });
		vscode.postMessage({ type: EventMessage.GET_ACTIVE_CHAT });
		vscode.postMessage({ type: EventMessage.CLEAR_CODE_CONTEXT });
		vscode.postMessage({ type: EventMessage.REQUEST_THEME });
	}, []);

	useEffect(() => {
		const handleReceiveVscodeMessage = (event: MessageEvent<VSCodeResponseMessage>) => {
			const message = event.data;
			switch (message.type as EventResponseMessage) {
				case EventResponseMessage.TOKEN_AND_USER_INFO: {
					const messageValue = message.value as {
						tokenInfo: TokenInfo;
						userInfo: UserInfo;
					};
					const tokenInfo = messageValue.tokenInfo;
					const userInfo = messageValue.userInfo;
					if (!tokenInfo || !userInfo) {
						setTokenInfo(null);
						setUserInfo(null);
						tokenManager.clearTokens();
						return;
					}
					if (userInfo.business_code === 'NEED_INVITE_CODE') {
						setError(ErrorMessage.NEED_INVITE_CODE);
					} else {
						setError(null);
					}
					setUserInfo(userInfo);
					tokenManager.setTokenInfo(tokenInfo.token, tokenInfo.refreshToken, tokenInfo.expiresAt);
					setTokenInfo(tokenInfo);
					if (Date.now() >= tokenInfo.expiresAt) {
						tokenManager.refreshTokenIfNeeded(onUpdateTokenInfo).catch((_error) => {
							onTokenExpired();
						});
					}
					break;
				}
				case EventResponseMessage.CODE_CONTEXT_SELECTION: {
					const selectedTextMessage = message as SelectedTextMessage;
					if (selectedTextMessage.command === 'extension.selectToChat') {
						setSelectionCodes(selectedTextMessage.value);
						if (textareaRef.current) {
							textareaRef.current.focus();
						}
					}
					break;
				}
				case EventResponseMessage.ACTIVE_CHAT: {
					if (!message.value) {
						return;
					}
					const activeChat = message.value as Chat;
					setCurrentChat(activeChat);
					resetMessages();
					break;
				}
				case EventResponseMessage.CHATS: {
					const chats = message.value as Chat[];
					setChats(chats);
					break;
				}
				case EventResponseMessage.NEW_CHAT:
					setIsNewChat(true);
					break;
				case EventResponseMessage.THEME_INFO: {
					const themeInfo = message.value as ThemeInfo;
					if (themeInfo) {
						setThemeInfo({
							name: themeInfo?.name || '',
							isDark: themeInfo?.isDark || false,
							isLight: themeInfo?.isLight || false,
						});
					}
					break;
				}
				case EventResponseMessage.NO_WORKSPACE_CHATS: {
					const noWorkspaceChats = message.value as Chat[];
					setNoWorkspaceChats(noWorkspaceChats);
					break;
				}
			}
		};

		window.addEventListener('message', handleReceiveVscodeMessage);
		return () => window.removeEventListener('message', handleReceiveVscodeMessage);
	}, []); // Dependencies might need adjustment based on how you use activePromptId

	const showHomePage = useMemo(
		() => chats?.length === 1 && messages.length === 0,
		[chats, messages],
	);

	// update the input value immediately
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInputValue(e.target.value);
	};

	const handleKeyPress = async (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (!inputValue) {
				return;
			}
			if (isTyping === 'typing') {
				await handleStopGeneration();
			}
			handleSendMessage(inputValue, selectionCodes);
		}
	};

	// add paste event handler
	const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		e.preventDefault();
		const textarea = e.target as HTMLTextAreaElement;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		try {
			const clipboardData = e.clipboardData;
			const pastedText = clipboardData.getData('text');

			// get the current input value
			const currentValue = inputValue;

			// insert the pasted text at the cursor position
			const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
			setInputValue(newValue);

			// set the new cursor position
			setTimeout(() => {
				if (textarea) {
					const newCursorPosition = start + pastedText.length;
					textarea.setSelectionRange(newCursorPosition, newCursorPosition);
				}
			}, 0);
		} catch (error) {
			// Fallback to simple paste if detection fails
			console.warn('Failed to detect clipboard source:', error);
			const pastedText = e.clipboardData.getData('text');
			const currentValue = inputValue;
			const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
			setInputValue(newValue);

			// set the new cursor position
			setTimeout(() => {
				if (textarea) {
					const newCursorPosition = start + pastedText.length;
					textarea.setSelectionRange(newCursorPosition, newCursorPosition);
				}
			}, 0);
		}
	};

	// add the function to update the height
	const updateTextareaHeight = (textarea: HTMLTextAreaElement) => {
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
	};

	const handleRemoveCode = (index: number) => {
		setSelectionCodes((prev) => {
			const newCodes = [...prev];
			newCodes.splice(index, 1);
			return newCodes;
		});
	};

	const handleOpenChat = (chat: Chat) => {
		setCurrentChat(chat);
		vscode.postMessage({
			type: EventMessage.MOVE_CHAT_TO_NO_WORKSPACE,
			value: chat.sessionId,
		});
		setIsNewChat(false);
	};

	// Ensure React app is rendered after DOM is loaded

	if (!isAuthenticated || !tokenInfo || !userInfo) {
		return <Login vscode={vscode} />;
	}

	// more chat tab
	return (
		<div
			className={`flex flex-col h-screen w-full bg-ai-bg-01 m-auto ${showHomePage ? 'justify-center gap-8' : ''}`}
		>
			{!showHomePage && (
				<div className="self-stretch  inline-flex justify-start items-center transition-all duration-300 overflow-x-auto no-scrollbar">
					{currentChat && <ChatTitle chat={currentChat} />}
				</div>
			)}
			{!showHomePage && (
				<div
					className="flex-1 overflow-y-auto p-4 pb-0 custom-show-scrollbar overflow-x-hidden"
					ref={messagesContainerRef}
				>
					<div className="flex flex-col space-y-2 min-h-full">
						{isLoading && <LoadingText text="Loading messages" position="center" />}
						<MessageList
							messages={messages}
							lastMessage={lastMessage}
							isTyping={isTyping}
							errorMessage={errorMessage}
							isThinking={isThinking}
						/>
						<div ref={messagesEndRef} className="h-6" />
					</div>
				</div>
			)}

			{showHomePage && <ChatWelcomeContent />}

			{chatError && chatError === ErrorMessage.NEED_INVITE_CODE && <ErrorHandler />}

			<div
				className={`self-stretch p-4 bg-ai-bg-01 inline-flex flex-col justify-start items-end gap-3 pt-0 ${
					showHomePage ? 'mt-8' : ''
				}`}
			>
				<div className="self-stretch p-4 bg-ai-bg-02 rounded-[8px] outline outline-1 outline-offset-[-1px] outline-ai-line-8% justify-between items-center overflow-hidden flex flex-col gap-4">
					<SelectionCodes selectionCodes={selectionCodes} onRemoveCode={handleRemoveCode} />
					<div className="text-center justify-start text-ai-gray-05 text-body font-regular font-inter w-full ">
						<textarea
							disabled={!!chatError}
							ref={textareaRef}
							value={inputValue}
							onChange={handleInputChange}
							onKeyDown={handleKeyPress}
							onPaste={handlePaste}
							placeholder="Ask a question..."
							className="flex-1 text-ai-gray-01 text-body font-regular font-inter focus:outline-none w-full bg-transparent resize-none min-h-[20px] max-h-[140px] overflow-y-auto custom-scrollbar"
							style={{
								minHeight: '20px',
								maxHeight: '140px',
							}}
						/>
					</div>
					<div className="w-full flex items-center justify-between gap-2 ">
						<ModelSelection selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
						{isTyping === 'typing' ? (
							<button
								onClick={handleStopGeneration}
								className="bg-ai-primary-blue-01 disabled:opacity-30 hover:opacity-70 text-ai-gray-01 p-[5px] rounded-full overflow-hidden focus:outline-none self-end flex justify-center items-center"
							>
								<RiStopFill size={18} className="text-white" />
							</button>
						) : (
							<button
								disabled={!!errorMessage || !inputValue.trim() || !!chatError}
								onClick={() => {
									if (!currentChat || !inputValue.trim()) {
										return;
									}
									handleSendMessage(inputValue, selectionCodes);
								}}
								className="bg-ai-primary-blue-01 disabled:opacity-30 hover:opacity-70 text-ai-gray-01 p-[5px] rounded-full overflow-hidden focus:outline-none self-end flex justify-center items-center"
							>
								<RiArrowUpLine size={18} className="text-white" />
							</button>
						)}
					</div>
				</div>
			</div>
			{showHomePage && (
				<AllChatsContent noWorkspaceChats={noWorkspaceChats} handleOpenChat={handleOpenChat} />
			)}
		</div>
	);
};

// Try to render immediately in case DOMContentLoaded event has already fired
if (document.readyState === 'loading') {
	console.log('Document still loading, will render on DOMContentLoaded');
} else {
	const rootElement = document.getElementById('root');
	if (rootElement) {
		createRoot(rootElement).render(<ChatApp />);
		console.log('React app rendered immediately to DOM');
	} else {
		console.error('Root element not found on immediate render attempt');
	}
}
