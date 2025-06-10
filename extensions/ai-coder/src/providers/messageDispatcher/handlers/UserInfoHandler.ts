import { Logger } from '../../../utils/logger';
import { EventResponseMessage } from '../../chatEventMessage';
import { AuthStateService } from '../../services/authStateService';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class UserInfoHandler implements MessageHandler {
  async handle(data: MessageData, context: MessageContext): Promise<void> {
    const { webview, context: extensionContext } = context;

    if (!extensionContext || !webview) {
      return;
    }
    try {
      const authStateService = AuthStateService.getInstance(extensionContext);

      webview.postMessage({
        type: EventResponseMessage.USER_INFO,
        value: authStateService.getUserInfo(),
      });
    } catch (error) {
      Logger.error(
        'Failed to handle user info request',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
