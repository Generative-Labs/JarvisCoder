import fs from 'fs';

import * as vscode from 'vscode';

import { EventMessage, EventResponseMessage } from './chatEventMessage';
import { SelectedTextMessageValue } from '../types/chats';
import { Logger } from '../utils/logger';
import { AuthHandler } from './messageDispatcher/handlers/AuthHandler';
import { ChatHandler } from './messageDispatcher/handlers/ChatHandler';
import { TerminalHandler } from './messageDispatcher/handlers/TerminalHandler';
import { ThemeHandler } from './messageDispatcher/handlers/ThemeHandler';
import { MessageDispatcher } from './messageDispatcher/MessageDispatcher';
import { createMessageDispatcher } from './messageDispatcher/MessageDispatcherFactory';
import { Middleware } from './messageDispatcher/types';
import { AuthStateService } from './services/authStateService';
import { ChatStateService } from './services/chatStateService';
import { CodeContextStateService } from './services/codeContextStateService';

/**
 * ChatViewProvider handles the chat interface within the VS Code extension.
 * It manages the webview that displays the chat UI and handles communication
 * between the webview and the extension.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _chatStateService: ChatStateService;
  private _workspacePath: string;
  private _messageDispatcher: MessageDispatcher;

  /**
   * Creates a new instance of the ChatViewProvider.
   */
  constructor(
    private readonly _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    middlewares: Middleware[] = []
  ) {
    this._context = context;
    this._workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '~';

    // Initialize services
    AuthStateService.getInstance(context);
    this._chatStateService = ChatStateService.getInstance(context);
    CodeContextStateService.getInstance(context);

    // Create message dispatcher with provided middlewares
    this._messageDispatcher = createMessageDispatcher(this, middlewares);

    // Initialize terminal to ensure proper directory setup through TerminalHandler
    TerminalHandler.getTerminal(true, true, true);
  }

  /**
   * Called when the webview view is first created or restored.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview using dispatcher pattern
    webviewView.webview.onDidReceiveMessage(
      async (data: {
        type: EventMessage;
        value: string | number | boolean | object | Array<string | number | boolean | object>;
      }) => {
        try {
          await this._messageDispatcher.dispatch(data, this);
        } catch (error) {
          Logger.error('Error handling webview message:', error instanceof Error ? error : new Error(String(error)));
        }
      }
    );
  }

  /**
   * Sends the selected text from the editor to the webview.
   */
  public sendSelectedTextToWebview(content: SelectedTextMessageValue[]): void {
    if (!this._view) {
      return;
    }
    const message = {
      type: EventResponseMessage.CODE_CONTEXT_SELECTION,
      value: content,
      command: 'extension.selectToChat',
    };
    this._view.webview.postMessage(message);
  }

  /**
   * Sends a message to the webview to show or hide the selection tip.
   */
  public sendSelectionTipToWebview(show: boolean): void {
    this._view?.webview.postMessage({
      type: show ? 'SHOW_SELECTION_TIP' : 'HIDE_SELECTION_TIP',
    });
  }

  /**
   * Handles the logout command by clearing user settings and restarting the auth listener.
   */
  public async onLogoutCommand(): Promise<void> {
    await AuthHandler.handleLogout(this._context, this._view?.webview);
    await AuthHandler.startAuthListener(this._view?.webview, this._context);
  }

  public async onNewChatCommand(): Promise<void> {
    if (this._view) {
      this._view.webview.postMessage({
        type: EventResponseMessage.NEW_CHAT,
      });
    }
  }

  public async setActiveChatCommand(path: string, sessionId: string): Promise<void> {
    await ChatHandler.setActiveChat(this._context, path, sessionId, this._view?.webview);
  }

  /**
   * Handles the clear all storage command by notifying the webview to clear its storage.
   */
  public onClearAllStorageCommand(): void {
    this._chatStateService.clearAllStorage();
    if (this._view) {
      this._view.webview.postMessage({
        type: EventResponseMessage.CLEAR_ALL_STORAGE,
      });
    }
  }

  /**
   * Get the webview instance for external access
   */
  public getWebview(): vscode.Webview | undefined {
    return this._view?.webview;
  }

  /**
   * Send theme information to webview (wrapper method)
   */
  public sendThemeInfo(): void {
    const webview = this.getWebview();
    if (webview) {
      ThemeHandler.sendThemeInfo(webview);
    }
  }

  /**
   * Generates the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    try {
      // Get path to HTML file
      const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'chat.html');
      let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

      // Get URI for JS file (using webview.asWebviewUri to handle vscode-resource: URIs)
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'chat.js'),
      );

      const nonce = this._getNonce();

      // Insert meta tag for CSP and script tag before closing body tag
      htmlContent = htmlContent.replace(
        '</head>',
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none';
        img-src https: vscode-resource:; 
        script-src 'unsafe-eval' 'unsafe-inline' vscode-resource: https://*.vscode-cdn.net; 
        style-src 'unsafe-inline' vscode-resource:; 
        connect-src 'self' http://127.0.0.1:8000 https://*.vscode-cdn.net https://jarvis-code-dev.chakrachain.io https://jarvis-code-test.chakrachain.io https://jarvis-code-devnet.chakrachain.io vscode-webview-resource:;">
        <script nonce="${nonce}" src="${scriptUri}"></script>
        </head>`,
      );

      Logger.debug(`Webview HTML prepared with script: ${scriptUri.toString()}`);
      return htmlContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      Logger.error('Error loading webview content:', errorMessage);
      return this._getErrorHtml(errorMessage);
    }
  }

  /**
   * Generates a random nonce for CSP (Content Security Policy).
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Generates an HTML error page to display when there's an error loading the chat interface.
   */
  private _getErrorHtml(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error Loading Chat View</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #e53935;
          }
          pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <h1>Error Loading Chat View</h1>
        <p>An error occurred while loading the chat interface. Please try reloading the window.</p>
        <pre>${errorMessage}</pre>
      </body>
      </html>`;
  }
}
