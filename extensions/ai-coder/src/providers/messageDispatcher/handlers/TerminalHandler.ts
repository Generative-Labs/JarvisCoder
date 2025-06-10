import * as vscode from 'vscode';

import { executeCommandsAndGetOutput } from '../../../utils/executeCommandsAndGetOutput';
import { Logger } from '../../../utils/logger';
import { parseCommands } from '../../../utils/parseCommands';
import { MessageHandler, MessageData, MessageContext } from '../types';

export class TerminalHandler implements MessageHandler {
  async handle(data: MessageData, context: MessageContext): Promise<void> {
    const command = data.value as string;
    try {
      const executableCommandsArray = parseCommands(command);
      if (executableCommandsArray.length === 0) {
        throw new Error('No valid command found to execute.');
      }
      
      const commandsToExecute = executableCommandsArray.join(' && ');
      const terminal = TerminalHandler.getTerminal(false, true);
      terminal.show();

      const _output = await executeCommandsAndGetOutput(commandsToExecute, terminal);
      
      // If webview is available, notify it that command has been executed
      if (context.webview) {
        context.webview.postMessage({
          type: 'terminalOpened',
          value: commandsToExecute,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      Logger.error('Error opening terminal:', errorMessage);
      
      if (context.webview) {
        context.webview.postMessage({
          type: 'error',
          value: `Failed to execute command in terminal: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }
  }
  
  /**
   * Get or create terminal instance
   * Static method that can be used without creating a TerminalHandler instance
   */
  static getTerminal(
    useExisting: boolean,
    openInCurrentDir: boolean,
    defaultOpen?: boolean,
  ): vscode.Terminal {
    const existingTerminals = vscode.window.terminals;

    const aiTrainingTerminal = existingTerminals.find((terminal) =>
      terminal.name.includes('ai-training'),
    );
    if (aiTrainingTerminal) {
      return aiTrainingTerminal;
    }

    if (useExisting) {
      if (existingTerminals.length > 0) {
        const terminal =
          vscode.window.activeTerminal || existingTerminals[existingTerminals.length - 1];
        return terminal;
      }
    }
    const terminalOptions: vscode.TerminalOptions = {
      name: defaultOpen ? '' : 'ai-training',
      cwd: openInCurrentDir ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
    };

    return vscode.window.createTerminal(terminalOptions);
  }
} 