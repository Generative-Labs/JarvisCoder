/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';

import { debounce } from 'lodash';

import { useAuth } from '../contexts/AuthContext';
import { useVSCode } from '../contexts/VSCodeContext';
import { EventMessage } from '../providers/chatEventMessage';
import { MessageResponse, sendMessageAction } from '../services/apiServices';
import { Chat, Message, SelectedTextMessageValue } from '../types/chats';
import { db, getMessagesFromDB, saveMessageToDB } from '../utils/db';
import { RateLimitedQueue } from '../utils/RateLimitedQueue';
import { mergeArrays } from '../utils/util';

interface UseMessagesProps {
	currentChat: Chat | null;
	perPageSize: number;
	messagesContainerRef: React.RefObject<HTMLDivElement | null>;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
	queue: RateLimitedQueue;
	handleUpdateChatTitle: (title: string) => void;
	resetForm: () => void;
	selectedModel: string;
}

export const useMessages = ({
	currentChat,
	perPageSize,
	messagesContainerRef,
	messagesEndRef,
	queue,
	handleUpdateChatTitle,
	resetForm,
	selectedModel,
}: UseMessagesProps): {
	messages: Message[];
	isLoading: boolean;
	error: string | null;
	currentPage: number;
	totalPages: number;
	handleLoadMore: () => Promise<void>;
	pushNewMessage: (message: Message) => Promise<void>;
	resetMessages: () => void;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	handleReceiveMessage: (response: MessageResponse) => Promise<void>;
	handleStopGeneration: () => void;
	handleSendMessage: (inputValue: string, selectionCodes: SelectedTextMessageValue[]) => void;
	isTyping: 'default' | 'typing' | 'done';
	isThinking: boolean;
	abortController: AbortController | null;
	errorMessage: string;
	lastMessage: Message | null;
} => {
	const { vscode } = useVSCode();
	const { onTokenExpired } = useAuth();
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [lastMessage, setLastMessage] = useState<Message | null>(null);
	const [isTyping, setIsTyping] = useState<'default' | 'typing' | 'done'>('default');
	const [isThinking, setIsThinking] = useState(true);
	const [abortController, setAbortController] = useState<AbortController | null>(null);
	const [errorMessage, setErrorMessage] = useState('');

	const scrollToBottom = useCallback(
		debounce(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
		}, 150),
		[messagesEndRef],
	);

	const isAtBottom = (): boolean => {
		const container = messagesContainerRef.current;
		if (!container) {
			return true;
		}
		return container.scrollHeight - container.scrollTop - container.clientHeight < 150;
	};

	const fetchMessages = useCallback(async (sessionId: string, page: number, pageSize: number) => {
		const totalMessages = await db.messages.where('session_id').equals(sessionId).count();
		const totalPages = Math.ceil(totalMessages / pageSize);
		const offset = Math.max(0, totalMessages - page * pageSize);
		try {
			const loadedMessages = await getMessagesFromDB(sessionId, pageSize, offset);
			return {
				messages: loadedMessages,
				totalPages,
			};
		} catch (_error) {
			throw _error;
		}
	}, []);

	const loadMessages = useCallback(async (): Promise<void> => {
		if (!currentChat) {
			return;
		}
		setIsLoading(true);

		try {
			const { messages: loadedMessages, totalPages } = await fetchMessages(
				currentChat?.sessionId ?? '',
				currentPage,
				perPageSize,
			);

			if (!loadedMessages || !totalPages) {
				throw new Error('Error loading messages');
			}

			if (currentPage === 1) {
				setMessages(loadedMessages);
				scrollToBottom();
			} else {
				setMessages((prev) => [...loadedMessages, ...prev]);
				if (currentPage < totalPages) {
					messagesContainerRef.current?.scrollTo({
						top: 300,
					});
				}
			}
			setTotalPages(totalPages);
		} catch (_error) {
			setError('Error loading messages');
		} finally {
			setIsLoading(false);
		}
	}, [
		fetchMessages,
		currentChat,
		currentPage,
		perPageSize,
		messagesContainerRef,
		messagesEndRef,
		scrollToBottom,
	]);

	const handleLoadMore = useCallback(async (): Promise<void> => {
		if (currentPage < totalPages && !isLoading) {
			setCurrentPage((prev) => prev + 1);
		}
	}, [currentPage, totalPages, isLoading]);

	const pushNewMessage = useCallback(
		async (message: Message): Promise<void> => {
			setMessages((prev) => [...prev, message]);
			try {
				await saveMessageToDB(message, currentChat?.sessionId ?? '');
			} catch (_error) {
				setErrorMessage('Error saving message');
			}
		},
		[currentChat],
	);

	useEffect(() => {
		loadMessages();
	}, [
		fetchMessages,
		currentChat,
		currentPage,
		perPageSize,
		scrollToBottom,
		messagesContainerRef,
		loadMessages,
	]);

	const handleReceiveMessage = useCallback(
		async (response: MessageResponse): Promise<void> => {
			const shouldScroll = isAtBottom();
			if (response.type === 'message') {
				setErrorMessage('');
				if (response?.data && response?.data?.text?.trim()) {
					setLastMessage((prev) => {
						if (prev) {
							return {
								...prev,
								text: `${prev.text}${response?.data?.text || ''}`,
							};
						}
						return {
							text: response?.data?.text || '',
							isUser: false,
							type: 'normal' as const,
							timestamp: response?.data?.timestamp,
						};
					});
				}
				if (shouldScroll) {
					scrollToBottom();
				}
			} else if (response.type === 'done') {
				if (queue.getQueueLength() === 0) {
					setIsTyping('done');
					setErrorMessage('');
					if (shouldScroll) {
						scrollToBottom();
					}
				}
			} else if (response.type === 'failed') {
				setErrorMessage('');
				setLastMessage({
					text: response?.data?.text || '',
					isUser: false,
					type: 'normal' as const,
					timestamp: response?.data?.timestamp,
				});
				setIsTyping('done');
				if (shouldScroll) {
					scrollToBottom();
				}
			}
			if (response.type === 'error') {
				setIsTyping('default');
				setErrorMessage(response?.error || '');
				if (shouldScroll) {
					scrollToBottom();
				}
			}
		},
		[scrollToBottom, isAtBottom, queue],
	);

	useEffect(() => {
		const saveMessages = async (): Promise<void> => {
			if (lastMessage && isTyping === 'done') {
				setIsThinking(false);
				await pushNewMessage(lastMessage);
				setLastMessage(null);
				setIsTyping('default');
			}
		};

		saveMessages();
	}, [lastMessage, isTyping, currentChat?.sessionId, pushNewMessage]);

	useEffect(() => {
		if (lastMessage && isTyping === 'typing') {
			const lines = lastMessage.text.split('\n');
			if (
				lines.some((line) => {
					if (
						line.trimStart().startsWith('```text ') &&
						(line.includes('type=thinking') || line.includes('type=think'))
					) {
						return true;
					}
					return false;
				})
			) {
				setIsThinking(true);
				if (lines.some((line) => line.trimEnd() === '```')) {
					setIsThinking(false);
				}
			}
		}
	}, [lastMessage, isTyping]);

	const handleReceiveMessageQueued = useCallback(
		(response: MessageResponse): void => {
			queue.enqueue(() => handleReceiveMessage(response));
		},
		[handleReceiveMessage, queue],
	);

	const handleStopGeneration = useCallback((): void => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
		}
		queue.clearQueue();
		setIsTyping('done');
	}, [abortController, queue]);

	const messageStateRef = useRef({
		currentChat,
		selectedModel,
		isAtBottom,
	});

	// Update ref when dependencies change
	useEffect(() => {
		messageStateRef.current = {
			currentChat,
			selectedModel,
			isAtBottom,
		};
	}, [currentChat, selectedModel, isAtBottom]);

	const handleSendMessage = useMemo(
		() =>
			debounce(
				async (inputValue: string, selectionCodes: SelectedTextMessageValue[]): Promise<void> => {
					const { currentChat, selectedModel, isAtBottom } = messageStateRef.current;

					if (!isAtBottom()) {
						scrollToBottom();
					}
					if (!inputValue) {
						return;
					}

					setIsTyping('typing');
					if (!currentChat) {
						return;
					}

					const controller = new AbortController();
					setAbortController(controller);

					let readyMessage = inputValue;
					if (selectionCodes.length > 0) {
						readyMessage = `${inputValue}\n\n${selectionCodes.map((code) => code.formattedText).join('\n')}`;
					}

					const newMessage = {
						text: inputValue,
						isUser: true,
						type: 'normal' as const,
						timestamp: Date.now(),
						selectionCodes: selectionCodes,
					};

					try {
						resetForm();
						vscode.postMessage({
							type: EventMessage.CLEAR_CODE_CONTEXT,
						});
						await pushNewMessage(newMessage);
						handleUpdateChatTitle(
							newMessage.text.length > 20 ? `${newMessage.text.substring(0, 20)}...` : newMessage.text,
						);

						const modelName = selectedModel === 'auto' ? '' : selectedModel;
						const codeContext = mergeArrays(...selectionCodes.map((code) => code.context));

						try {
							// Notify backend for telemetry tracking
							vscode.postMessage({
								type: EventMessage.SEND_MESSAGE_TO_LLM,
								value: {
									message: readyMessage,
									session_id: currentChat.sessionId,
									model_name: modelName,
									code_context: codeContext.length > 0 ? codeContext : undefined,
								},
							});
						} catch (_telemetryError) { }

						await sendMessageAction(
							{
								message: readyMessage,
								session_id: currentChat.sessionId,
								model_name: modelName,
								code_context: codeContext.length > 0 ? codeContext : undefined,
							},
							handleReceiveMessageQueued,
							controller.signal,
						);
					} catch (error: unknown) {
						setIsTyping('default');
						if (error instanceof Error) {
							if (error.message === 'refresh_token_expired') {
								onTokenExpired();
							} else if (error.name === 'AbortError') {
								// Request was aborted
							} else {
								// Error sending message
							}
						}
					} finally {
						setAbortController(null);
					}
				},
				300,
			),
		[
			handleReceiveMessageQueued,
			onTokenExpired,
			resetForm,
			pushNewMessage,
			handleUpdateChatTitle,
			vscode,
			scrollToBottom,
		],
	);

	const resetMessages = useCallback((): void => {
		setMessages([]);
		setCurrentPage(1);
		setTotalPages(1);
		setLastMessage(null);
		setError(null);
	}, []);

	return {
		messages,
		isLoading,
		error,
		currentPage,
		totalPages,
		handleLoadMore,
		pushNewMessage,
		resetMessages,
		setCurrentPage,
		handleReceiveMessage,
		handleStopGeneration,
		handleSendMessage,
		isTyping,
		isThinking,
		abortController,
		errorMessage,
		lastMessage,
	};
};
