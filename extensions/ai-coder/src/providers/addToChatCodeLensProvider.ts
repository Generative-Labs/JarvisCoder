import * as vscode from 'vscode';

export class AddToChatCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return [];
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      return [];
    }

    // only show CodeLens in the last line of the selection
    const line = selection.end.line;
    return [
      new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
        title: 'Add to Chat ⌘+L',
        command: 'extension.selectToChat',
        tooltip: 'Add selection to chat',
        arguments: [],
      }),
    ];
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}
