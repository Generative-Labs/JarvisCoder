import * as vscode from 'vscode';

import { MessageHandler, MessageData, MessageContext } from '../types';

export class FileHandler implements MessageHandler {
  async handle(data: MessageData, _context: MessageContext): Promise<void> {
    await FileHandler.handleOpenFileAndSelect(
      data.value as { filePath: string; startLine: number; endLine: number }
    );
  }
  
  /**
   * Open file and select specified lines
   * Static method that can be used without creating a FileHandler instance
   */
  static async handleOpenFileAndSelect(value: { filePath: string; startLine: number; endLine: number }): Promise<void> {
    const { filePath, startLine, endLine } = value;

    // Open file
    const uri = vscode.Uri.file(filePath);
    const editor = await vscode.window.showTextDocument(uri);

    // If line selection is provided, select the lines
    if (startLine !== undefined && endLine !== undefined) {
      const range = new vscode.Range(
        new vscode.Position(startLine - 1, 0), // VSCode uses 0-based line numbers
        new vscode.Position(endLine - 1, Number.MAX_SAFE_INTEGER), // Select entire line
      );
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  }
} 