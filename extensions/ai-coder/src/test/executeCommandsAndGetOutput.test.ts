/**
 * @file Test suite for executeCommandsAndGetOutput utility
 */

// Uncomment when needed for testing
// import * as assert from "assert";
import * as vscode from "vscode";

// Uncomment when needed for testing
// import { executeCommandsAndGetOutput } from "../utils/executeCommandsAndGetOutput";

/**
 * Test suite for executeCommandsAndGetOutput utility
 */
suite("executeCommandsAndGetOutput Test Suite", () => {
  /** Test terminal instance */
  let testTerminal: vscode.Terminal | undefined;

  /**
   * Clean up test terminal after each test
   */
  teardown(async () => {
    if (testTerminal) {
      testTerminal.dispose();
      testTerminal = undefined;
      // Add a small delay to ensure VS Code processes the disposal
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });

  // test("Should execute command in a terminal and get output", async () => {
  //   testTerminal = vscode.window.createTerminal(`TestTerminal-${Date.now()}`);
  //   // A short delay to give the terminal time to initialize
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   const command = 'echo "Hello from terminal"';
  //   const output = await executeCommandsAndGetOutput(command, testTerminal);
  //   assert.strictEqual(output.trim(), "Hello from terminal");
  // });

  /**
   * Tests if the command execution captures both stdout and stderr
   */
  // test("Should execute command with stdout and stderr in terminal", async () => {
  //   testTerminal = vscode.window.createTerminal(
  //     `TestTerminalStdErr-${Date.now()}`
  //   );
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   const command = [
  //     'node',
  //     '-e',
  //     '\'process.stdout.write("Hello from stdout"); ' +
  //     'process.stderr.write("Hello from stderr");\''
  //   ].join(' ');
  //   
  //   const output = await executeCommandsAndGetOutput(command, testTerminal);

  //   assert.ok(
  //     output.includes("Hello from stdout"),
  //     "Output should contain stdout part"
  //   );
  //   assert.ok(
  //     output.includes("Hello from stderr"),
  //     "Output should contain stderr part"
  //   );
  // });

  /**
   * Tests command timeout handling
   */
  // test("Should handle command timeout", async function () {
  //   // Set timeout for this test
  //   this.timeout(60000);
  //   this.slow(30000);

  //   testTerminal = vscode.window.createTerminal(
  //     `TestTerminalTimeout-${Date.now()}`
  //   );
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   const longRunningCommand = process.platform === "win32"
  //     ? "timeout /t 13 /nobreak > nul" // Sleep for 13 seconds on Windows
  //     : "sleep 13"; // Sleep for 13 seconds on Unix

  //   const output = await executeCommandsAndGetOutput(
  //     longRunningCommand,
  //     testTerminal,
  //     { timeout: 5000 } // Set a shorter timeout for testing
  //   );

  //   assert.ok(
  //     output.startsWith("Timeout waiting for command completion."),
  //     `Expected timeout message, got: "${output}"`
  //   );
  //   assert.ok(
  //     output.includes("Partial output:"),
  //     `Expected partial output section, got: "${output}"`
  //   );
  // });

  /**
   * Tests partial output capture before timeout
   */
  // test("Should capture partial output before timeout", async function () {
  //   this.timeout(60000);
  //   this.slow(30000);

  //   // Clean up any existing terminal
  //   if (testTerminal) {
  //     testTerminal.dispose();
  //     testTerminal = undefined;
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }


  //   testTerminal = vscode.window.createTerminal(
  //     `TestTerminalTimeoutPartial-${Date.now()}`
  //   );
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   const commandWithPartialOutput = process.platform === "win32"
  //     ? "(echo partial_early_output & timeout /t 13 /nobreak > nul)"
  //     : 'echo "partial_early_output" && sleep 13';

  //   const outputWithPartial = await executeCommandsAndGetOutput(
  //     commandWithPartialOutput,
  //     testTerminal,
  //     { timeout: 3000 } // Short timeout to trigger partial output
  //   );

  //   assert.ok(
  //     outputWithPartial.startsWith("Timeout waiting for command completion."),
  //     `Expected timeout message, got: "${outputWithPartial}"`
  //   );
  //   assert.ok(
  //     outputWithPartial.includes("partial_early_output"),
  //     `Expected partial output, got: "${outputWithPartial}"`
  //   );
  // });
});
