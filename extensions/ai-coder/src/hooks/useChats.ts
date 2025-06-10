import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { useVSCode } from '../contexts/VSCodeContext';
import { EventMessage } from '../providers/chatEventMessage';
import { openChatAction } from '../services/apiServices';
import { Chat } from '../types/chats';

export const useChats = (): {
  chats: Chat[] | null;
  setChats: React.Dispatch<React.SetStateAction<Chat[] | null>>;
  currentChat: Chat | null;
  setCurrentChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  isNewChat: boolean;
  setIsNewChat: React.Dispatch<React.SetStateAction<boolean>>;
  handleUpdateChatTitle: (title: string) => void;
  handleOpenNewChat: () => Promise<void>;
} => {
  const { vscode } = useVSCode();
  const { userInfo, onTokenExpired } = useAuth();

  const [chats, setChats] = useState<Chat[] | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);

  const handleUpdateChatTitle = useCallback(
    (title: string): void => {
      if (!currentChat) {
        return;
      }

      setCurrentChat((prev) => {
        if (!prev) {
          return null;
        }
        return {
          ...prev,
          title,
        };
      });

      vscode.postMessage({
        type: EventMessage.UPDATE_CHAT_TITLE,
        value: {
          sessionId: currentChat.sessionId,
          title,
        },
      });
    },
    [currentChat, vscode],
  );

  const handleOpenNewChat = useCallback(async (): Promise<void> => {
    if (!userInfo) {
      setIsNewChat(false);
      onTokenExpired();
      return;
    }

    if (userInfo?.uuid) {
      try {
        const response = await openChatAction(userInfo.uuid);
        if (response?.code === 200 && response?.session_id) {
          const sessionInfo = {
            sessionId: response.session_id,
            modelName: response.model_name,
            modelParameters: response.model_parameters,
          };
          const newChat = {
            title: '',
            sessionId: sessionInfo.sessionId,
            modelName: sessionInfo.modelName,
            timestamp: Date.now(),
          };
          setChats([newChat]);
          setCurrentChat(newChat);
          vscode.postMessage({
            type: EventMessage.OPEN_NEW_CHAT,
            value: newChat,
          });
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'refresh_token_expired') {
          onTokenExpired();
        }
      } finally {
        setIsNewChat(false);
      }
    }
  }, [userInfo, vscode, onTokenExpired]);

  // Save chats to IndexedDB when they change
  useEffect(() => {
    const saveChats = async (): Promise<void> => {
      if (!chats || !userInfo) {
        return;
      }
      if (chats.length <= 0) {
        handleOpenNewChat();
        return;
      }
    };
    saveChats();
  }, [chats, userInfo]);

  useEffect(() => {
    if (isNewChat) {
      handleOpenNewChat();
    }
  }, [isNewChat, handleOpenNewChat]);

  return {
    chats,
    setChats,
    currentChat,
    setCurrentChat,
    isNewChat,
    setIsNewChat,
    handleUpdateChatTitle,
    handleOpenNewChat,
  };
};
