import React, { useState, useEffect, useRef, useCallback, Profiler, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
// import './chat.css';
import 'remixicon/fonts/remixicon.css';
import { RiArrowUpLine, RiStopFill } from '@remixicon/react';
import Login from './components/auth/Login';
import { debounce } from 'lodash';
import { RateLimitedQueue } from './utils/RateLimitedQueue';
import { EventMessage, EventResponseMessage } from './providers/chatEventMessage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VSCodeProvider } from './contexts/VSCodeContext';
import { ThemeInfo, useTheme, ThemeProvider } from './contexts/ThemeContext';
import MessageList from './components/chat/MessageList';
import { tokenManager } from './utils/tokenManager';
import ChatTitle from './components/chat/ChatTitle';
import { Chat, SelectedTextMessage, SelectedTextMessageValue } from './types/chats';
import { TokenInfo } from './types/auth';
import { UserInfo } from './types/auth';
import SelectionCodes from './components/chat/SelectionCodes';
import { logger } from './utils/logger';
import LoadingText from './components/common/LoadingText';
import { useMessages } from './hooks/useMessages';
import { useChats } from './hooks/useChats';

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

function onRenderCallback(id: string, phase: string, actualDuration: number) {
  console.log(`Profiler [${id}] - ${phase} - ${actualDuration} ms`);
}

// Ensure React app is rendered after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <Profiler id="chat" onRender={onRenderCallback}>
        <VSCodeProvider vscode={vscode}>
          <AuthProvider>
            <ThemeProvider>
              <ChatApp />
            </ThemeProvider>
          </AuthProvider>
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
  const { handleUpdateChatTitle, currentChat, setCurrentChat, setIsNewChat, setChats, isNewChat } =
    useChats();
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
    vscode.postMessage({ type: EventMessage.GET_ACTIVE_CHAT });
    vscode.postMessage({ type: EventMessage.CLEAR_CODE_CONTEXT });
    vscode.postMessage({ type: EventMessage.REQUEST_THEME });
  }, []);

  useEffect(() => {
    const handleReceiveVscodeMessage = (event: MessageEvent<VSCodeResponseMessage>) => {
      const message = event.data;
      switch (message.type as EventResponseMessage) {
        case EventResponseMessage.TOKEN_AND_USER_INFO:
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
          setUserInfo(userInfo);
          tokenManager.setTokenInfo(tokenInfo.token, tokenInfo.refreshToken, tokenInfo.expiresAt);
          setTokenInfo(tokenInfo);
          if (Date.now() >= tokenInfo.expiresAt) {
            tokenManager.refreshTokenIfNeeded(onUpdateTokenInfo).catch((error) => {
              onTokenExpired();
            });
          }
          break;
        case EventResponseMessage.CODE_CONTEXT_SELECTION:
          const selectedTextMessage = message as SelectedTextMessage;
          if (selectedTextMessage.command === 'extension.selectToChat') {
            logger.debug('🔍 selectedTextMessage.value' + selectedTextMessage.value);
            setSelectionCodes(selectedTextMessage.value);
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }
          break;
        case EventResponseMessage.ACTIVE_CHAT:
          if (!message.value) {
            return;
          }
          const activeChat = message.value as Chat;
          setCurrentChat(activeChat);
          resetMessages();
          break;
        case EventResponseMessage.CHATS:
          const chats = message.value as Chat[];
          setChats(chats);
          break;
        case EventResponseMessage.NEW_CHAT:
          setIsNewChat(true);
          break;
        case EventResponseMessage.THEME_INFO:
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
    };

    window.addEventListener('message', handleReceiveVscodeMessage);
    return () => window.removeEventListener('message', handleReceiveVscodeMessage);
  }, []); // Dependencies might need adjustment based on how you use activePromptId

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
      if (isTyping == 'typing') {
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
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
  };

  const handleRemoveCode = (index: number) => {
    setSelectionCodes((prev) => {
      const newCodes = [...prev];
      newCodes.splice(index, 1);
      return newCodes;
    });
  };

  // Ensure React app is rendered after DOM is loaded

  if (!isAuthenticated || !tokenInfo || !userInfo) {
    return <Login vscode={vscode} />;
  }

  // more chat tab
  return (
    <div className="flex flex-col h-screen w-full bg-ai-bg-01 m-auto">
      <div className="self-stretch  inline-flex justify-start items-center transition-all duration-300 overflow-x-auto no-scrollbar">
        {currentChat && <ChatTitle chat={currentChat} />}
      </div>

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
      <div className="self-stretch p-4 bg-ai-bg-01 inline-flex flex-col justify-start items-end gap-3 pt-0">
        <div className="self-stretch p-4 bg-ai-bg-02 rounded-[8px] outline outline-1 outline-offset-[-1px] outline-ai-line-8% justify-between items-center overflow-hidden flex flex-col gap-4">
          <SelectionCodes selectionCodes={selectionCodes} onRemoveCode={handleRemoveCode} />
          <div className="text-center justify-start text-ai-gray-05 text-body font-regular font-inter w-full ">
            <textarea
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
            <div className="flex items-center gap-2 px-2 py-1.5 bg-ai-bg-02 border border-code-block-border-color hover:bg-ai-bg-03 text-ai-gray-01 hover:text-ai-gray-01 rounded-[6px] hover:cursor-pointer">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-ai-gray-05 hover:text-ai-gray-01 text-caption1 font-regular font-inter border-none focus:outline-none"
              >
                <option value="auto" className="hover:cursor-pointer">
                  Auto
                </option>
                <option value="gemini-2.5-pro" className="hover:cursor-pointer">
                  Gemini 2.5 Pro
                </option>
                <option value="claude-3.7-sonnet" className="hover:cursor-pointer">
                  Claude 3.7 Sonnet
                </option>
                <option value="claude-4-opus" className="hover:cursor-pointer">
                  Claude 4 Opus
                </option>
                <option value="claude-4-sonnet" className="hover:cursor-pointer">
                  Claude 4 Sonnet
                </option>
                <option value="gpt-4.1">GPT-4.1</option>
              </select>
            </div>

            {isTyping === 'typing' ? (
              <button
                onClick={handleStopGeneration}
                className="bg-ai-primary-blue-01 disabled:opacity-30 hover:opacity-70 text-ai-gray-01 p-[5px] rounded-full overflow-hidden focus:outline-none self-end flex justify-center items-center"
              >
                <RiStopFill size={18} className="text-white" />
              </button>
            ) : (
              <button
                disabled={!!errorMessage || !inputValue.trim()}
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
