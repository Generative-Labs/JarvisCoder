import * as vscode from 'vscode';

import { EventResponseMessage } from '../../chatEventMessage';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class ThemeHandler implements MessageHandler {
  async handle(data: MessageData, context: MessageContext): Promise<void> {
    const { webview } = context;
    
    if (webview) {
      ThemeHandler.sendThemeInfo(webview);
    }
  }
  
  /**
   * Send theme information to webview
   * Static method that can be used without creating a ThemeHandler instance
   */
  static sendThemeInfo(webview: vscode.Webview): void {
    const activeTheme = vscode.window.activeColorTheme;
    const config = vscode.workspace.getConfiguration();
    const themeName = config.get<string>('workbench.colorTheme') || 'Unknown';

    webview.postMessage({
      type: EventResponseMessage.THEME_INFO,
      value: {
        name: themeName,
        kind: activeTheme.kind,
        isDark: activeTheme.kind === vscode.ColorThemeKind.Dark,
        isLight: activeTheme.kind === vscode.ColorThemeKind.Light,
        isHighContrast: activeTheme.kind === vscode.ColorThemeKind.HighContrast,
      },
    });
  }
} 