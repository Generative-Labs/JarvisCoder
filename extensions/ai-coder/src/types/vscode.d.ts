/**
 * Extended Window interface to include VS Code webview API
 */
declare interface Window {
	/** VS Code webview API */
	vscode: {
		/**
		 * Post a message to the extension host
		 * @param message - The message to post to the extension host
		 * @returns
		 */
		postMessage(message: unknown): void;
	};
}
