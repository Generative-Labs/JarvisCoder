import * as vscode from "vscode";

/**
 * Executes commands in a VS Code terminal and captures the output
 * @param {string} commands - The commands to execute in the terminal
 * @param {vscode.Terminal} terminal - The VS Code terminal instance to use for command execution
 * @returns {Promise<void>} A promise that resolves when the command is sent to the terminal
 *
 * @description
 * This function sends the provided commands to the specified VS Code terminal.
 * Note: The current implementation only sends the command to the terminal without capturing output.
 * The commented-out code shows a more complex implementation that could capture output.
 *
 * @example
 * ```typescript
 * const terminal = vscode.window.createTerminal('My Terminal');
 * await executeCommandsAndGetOutput('echo "Hello World"', terminal);
 * ```
 */
export async function executeCommandsAndGetOutput(
  commands: string,
  terminal: vscode.Terminal
): Promise<void> {
  terminal.sendText(commands, true); // Send command and ensure it executes (addNewLine = true)
}

// Helper function to poll for a marker in a file
// async function waitForMarker(
//   filePath: string,
//   marker: string,
//   timeout: number = 10000,
//   interval: number = 200
// ): Promise<boolean> {
//   const startTime = Date.now();
//   while (Date.now() - startTime < timeout) {
//     try {
//       if ((await fs.stat(filePath)).size > 0) {
//         // Check if file has content before reading
//         const content = await fs.readFile(filePath, "utf-8");
//         if (content.includes(marker)) {
//           return true;
//         }
//       }
//     } catch (error) {
//       // File might not exist yet, be empty, or other read errors, ignore and retry
//     }
//     await new Promise((resolve) => setTimeout(resolve, interval));
//   }
//   return false; // Timeout
// }

// // Helper function to determine shell type
// function getShellType(
//   terminal?: vscode.Terminal
// ): "posix" | "cmd" | "powershell" | "unknown" {
//   if (
//     !terminal ||
//     !terminal.creationOptions ||
//     typeof (terminal.creationOptions as vscode.TerminalOptions).shellPath !==
//       "string"
//   ) {
//     // Fallback based on OS if terminal shellPath is not available or not a string
//     if (os.platform() === "win32") {
//       // Assume PowerShell as a common default on Windows if specific shell isn't known.
//       // VS Code often defaults to PowerShell.
//       return "powershell";
//     }
//     return "posix"; // Default to POSIX for non-Windows if shellPath is unknown
//   }

//   const shellPathRaw = (terminal.creationOptions as vscode.TerminalOptions)
//     .shellPath;
//   const shellPath =
//     typeof shellPathRaw === "string" ? shellPathRaw.toLowerCase() : "";

//   if (shellPath.includes("powershell.exe") || shellPath.includes("pwsh.exe")) {
//     return "powershell";
//   }
//   if (shellPath.includes("cmd.exe")) {
//     return "cmd";
//   }
//   // Common POSIX shells
//   if (
//     shellPath.includes("bash") ||
//     shellPath.includes("zsh") ||
//     shellPath.includes("sh") ||
//     shellPath.includes("fish") ||
//     shellPath.includes("ksh")
//   ) {
//     return "posix";
//   }

//   // If none of the above, try OS-based fallback again for unrecognized shell paths
//   if (os.platform() === "win32") {
//     // If it's Windows and the shellPath didn't match cmd or powershell,
//     // it's hard to be certain. PowerShell is a safer bet for modern systems.
//     return "powershell";
//   }
//   return "posix"; // Default to POSIX for others (e.g. custom Linux/macOS shells)
// }
