import { MessageDispatcher } from './MessageDispatcher';
import { EventMessage } from '../chatEventMessage';
import { AuthHandler } from './handlers/AuthHandler';
import { ChatHandler } from './handlers/ChatHandler';
import { CodeContextHandler } from './handlers/CodeContextHandler';
import { CodeDiffHandler } from './handlers/CodeDiffHandler';
import { FileHandler } from './handlers/FileHandler';
import { TerminalHandler } from './handlers/TerminalHandler';
import { ThemeHandler } from './handlers/ThemeHandler';
import { TokenHandler } from './handlers/TokenHandler';
import { UserInfoHandler } from './handlers/UserInfoHandler';
import { Middleware } from './types';
import { ChatStateService } from '../services/chatStateService';
import { CodeContextStateService } from '../services/codeContextStateService';

/**
 * Create configured message dispatcher
 */
export function createMessageDispatcher(
  chatViewProvider: any, 
  middlewares: Middleware[] = []
): MessageDispatcher {
  const dispatcher = new MessageDispatcher({
    enableMiddlewares: true,
    logUnhandledMessages: true,
    timeout: 30000
  });

  // Extract services and necessary references
  const chatStateService = ChatStateService.getInstance(chatViewProvider._context);
  const codeContextStateService = CodeContextStateService.getInstance(chatViewProvider._context);
  const context = chatViewProvider._context;
  const workspacePath = chatViewProvider._workspacePath;

  // Register all provided middlewares
  middlewares.forEach(middleware => {
    dispatcher.use(middleware);
  });

  // Create handlers with injected services
  const authHandler = new AuthHandler();
  const chatHandler = new ChatHandler(chatStateService, context, workspacePath);
  const codeDiffHandler = new CodeDiffHandler();
  const terminalHandler = new TerminalHandler();
  const tokenHandler = new TokenHandler();
  const userInfoHandler = new UserInfoHandler();
  const themeHandler = new ThemeHandler();
  const fileHandler = new FileHandler();
  const codeContextHandler = new CodeContextHandler(codeContextStateService);

  // Set message context to add context
  dispatcher.setContextEnhancer((data, baseContext) => ({
    ...baseContext,
    context // Add extension context
  }));

  // Batch register handlers
  dispatcher.registerMany({
    [EventMessage.START_AUTH]: authHandler,
    [EventMessage.LOGOUT]: authHandler,
    [EventMessage.REFRESH_TOKEN_EXPIRED]: authHandler,
    
    [EventMessage.GET_CHATS]: chatHandler,
    [EventMessage.OPEN_NEW_CHAT]: chatHandler,
    [EventMessage.DELETE_CHAT]: chatHandler,
    [EventMessage.GET_ACTIVE_CHAT]: chatHandler,
    [EventMessage.SET_ACTIVE_CHAT]: chatHandler,
    [EventMessage.UPDATE_CHAT_TITLE]: chatHandler,
    
    [EventMessage.SHOW_CODE_DIFF]: codeDiffHandler,
    [EventMessage.ACCEPT_ALL_CHANGES]: codeDiffHandler,
    [EventMessage.REJECT_ALL_CHANGES]: codeDiffHandler,
    
    [EventMessage.OPEN_IN_TERMINAL]: terminalHandler,
    
    [EventMessage.REQUEST_TOKEN_AND_USER_INFO]: tokenHandler,
    [EventMessage.SAVE_TOKEN_INFO]: tokenHandler,
    
    [EventMessage.GET_USER_INFO]: userInfoHandler,
    
    [EventMessage.REQUEST_THEME]: themeHandler,
    
    [EventMessage.OPEN_FILE_AND_SELECT]: fileHandler,
    
    [EventMessage.CLEAR_CODE_CONTEXT]: codeContextHandler,
  });

  return dispatcher;
} 