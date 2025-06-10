import { compressText, decompressText } from "./compression";
import { logger } from "./logger";

/**
 * Represents a chat message
 */
interface ChatMessage {
  text: string;
  [key: string]: unknown;
}

/**
 * Represents a chat with messages
 */
interface Chat {
  messages: ChatMessage[];
  [key: string]: unknown;
}

/**
 * Type for worker message events
 */
type WorkerMessageEvent = MessageEvent<{
  type: 'processChats' | 'decompressChats';
  data: Chat[];
}>;

/**
 * Processes chat messages by compressing or decompressing text content
 * @param {WorkerMessageEvent} event - The message event from the worker
 * @returns {void}
 */
const handleMessage = (event: WorkerMessageEvent): void => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'processChats': {
        const processedChats = data.map((chat: Chat) => ({
          ...chat,
          messages: chat.messages.map((msg: ChatMessage) => ({
            ...msg,
            text: compressText(msg.text),
          })),
        }));
        self.postMessage(processedChats);
        break;
      }

      case 'decompressChats': {
        const decompressedChats = data.map((chat: Chat) => ({
          ...chat,
          messages: chat.messages.map((msg: ChatMessage) => ({
            ...msg,
            text: decompressText(msg.text),
          })),
        }));
        self.postMessage(decompressedChats);
        break;
      }

      default:
        // No action needed for unknown message types
        break;
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error processing chat data', error);
    } else {
      logger.error(`Error processing chat data: ${String(error)}`);
    }
  }
};

// Set up the message event listener
self.onmessage = handleMessage;
