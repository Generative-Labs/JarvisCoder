import * as fs from "fs";

import * as vscode from "vscode";

/**
 * Showing diff and applying changes in VSCode extension.
 *
 * Usage example:
 * ```typescript
 * // Compare two files
 * const controller = new CodeDiffController(
 *   context,
 *   originalFileUri,
 *   modifiedFileUri
 * );
 *
 * // Or compare file with text
 * const textController = new CodeDiffController(
 *   context,
 *   fileUri,
 *   "Text content to compare with file"
 * );
 *
 * // Show diff between files
 * await controller.showDiff();
 *
 * // Accept changes with callback
 * await controller.acceptChanges(() => {
 *   console.log("Changes accepted");
 * });
 *
 * // Reject changes with callback
 * await controller.rejectChanges(() => {
 *   console.log("Changes rejected");
 * });
 * ```
 */
export class CodeDiffController {
  private context: vscode.ExtensionContext;
  private currentLeftFileUri: vscode.Uri | undefined;
  private currentRightFileUri: vscode.Uri | undefined;
  private tempFileCreated: boolean = false;
  private inMemoryContent: string | undefined;
  private contentProvider: vscode.Disposable | undefined;

  /**
   * Creates a new instance of the CodeDiffController
   * @param {vscode.ExtensionContext} context - The extension context
   * @param {vscode.Uri} leftFileUri - The URI of the original file
   * @param {vscode.Uri | string} rightFileUriOrContent - Either the URI of the modified file or the content to compare
   */
  constructor(
    context: vscode.ExtensionContext,
    leftFileUri: vscode.Uri,
    rightFileUriOrContent: vscode.Uri | string
  ) {
    this.context = context;
    this.currentLeftFileUri = leftFileUri;

    if (typeof rightFileUriOrContent === "string") {
      // Use in-memory document instead of temporary file
      this.inMemoryContent = rightFileUriOrContent;
      this.currentRightFileUri = this.registerInMemoryDocument(
        rightFileUriOrContent
      );
    } else {
      this.currentRightFileUri = rightFileUriOrContent;
    }
  }

  /**
   * Creates an in-memory document with the given content
   * @param {string} content - Text content for the in-memory document
   * @returns {vscode.Uri} URI of the in-memory document
   */
  private registerInMemoryDocument(content: string): vscode.Uri {
    const scheme = "diff-preview";
    const fileName = `diff-preview-${Date.now()}.txt`;
    const uri = vscode.Uri.parse(`${scheme}:${fileName}`);

    this.inMemoryContent = content;

    // Register a content provider for our custom scheme
    this.contentProvider = vscode.workspace.registerTextDocumentContentProvider(
      scheme,
      {
        /**
         * Provides the content of the in-memory document
         * @param {vscode.Uri} _uri - The URI of the document
         * @returns {string | undefined} The content of the document
         */
        provideTextDocumentContent: (_uri: vscode.Uri) => this.inMemoryContent,
      }
    );

    this.context.subscriptions.push(this.contentProvider);

    return uri;
  }

  /**
   * Shows the difference between the left and right files in a diff view
   * @returns {Promise<void>} A promise that resolves when the diff view is shown
   */
  async showDiff(): Promise<void> {
    // Show diff editor
    await vscode.commands.executeCommand(
      "vscode.diff",
      this.currentLeftFileUri,
      this.currentRightFileUri,
      "Compare Changes"
    );
  }

  /**
   * Accepts the changes from the right file and applies them to the left file
   * @param {() => void} [onAccept] - Optional callback function to execute after changes are accepted
   * @returns {Promise<void>} A promise that resolves when the changes have been accepted
   */
  async acceptChanges(onAccept?: () => void): Promise<void> {
    if (!this.currentLeftFileUri || !this.currentRightFileUri) {
      vscode.window.showErrorMessage("No active diff to accept.");
      return;
    }

    let rightContent: string;

    // If we have in-memory content, use it directly
    if (this.inMemoryContent !== undefined) {
      rightContent = this.inMemoryContent;
    } else {
      // Otherwise read from the file
      const rightDoc = await vscode.workspace.openTextDocument(
        this.currentRightFileUri
      );
      rightContent = rightDoc.getText();
    }

    // Write the content to the left file
    const leftDoc = await vscode.workspace.openTextDocument(
      this.currentLeftFileUri
    );
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      leftDoc.positionAt(0),
      leftDoc.positionAt(leftDoc.getText().length)
    );
    edit.replace(this.currentLeftFileUri, fullRange, rightContent);
    await vscode.workspace.applyEdit(edit);
    await leftDoc.save();

    if (onAccept) {
      onAccept();
    }

    this.clearUris();
  }

  /**
   * Rejects the changes and cleans up resources
   * @param {() => void} [onReject] - Optional callback function to execute after changes are rejected
   * @returns {Promise<void>} A promise that resolves when the changes have been rejected
   */
  async rejectChanges(onReject?: () => void): Promise<void> {
    if (!this.currentLeftFileUri || !this.currentRightFileUri) {
      // Or handle silently if no diff is active
      // vscode.window.showInformationMessage("No active diff to reject.");
      if (onReject) {
        onReject(); // Call onReject even if there's nothing to "reject" in terms of file changes
      }
      this.clearUris();
      return;
    }

    if (onReject) {
      onReject();
    }

    this.clearUris();
  }

  /**
   * Cleans up temporary files and resources
   * @private
   */
  private clearUris(): void {
    // Clean up temporary file if created
    if (this.tempFileCreated && this.currentRightFileUri) {
      try {
        fs.unlinkSync(this.currentRightFileUri.fsPath);
      } catch (_error) {
        // Silently fail if we can't delete the temporary file
      }
    }

    // Dispose content provider if we created one
    if (this.contentProvider) {
      this.contentProvider.dispose();
      this.contentProvider = undefined;
      this.inMemoryContent = undefined;
    }

    this.currentLeftFileUri = undefined;
    this.currentRightFileUri = undefined;
  }
}
