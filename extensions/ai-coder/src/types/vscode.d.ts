/**
 * Extended Window interface to include VS Code webview API
 */
declare interface Window {
  /** VS Code webview API */
  vscode: {
    /**
     * Post a message to the extension host
     * @param {unknown} message - The message to post to the extension host
     * @returns {void}
     */
    postMessage(message: unknown): void;
  };
}
