# VS Code Extension Debugging Guide

## Prerequisites
- Node.js installed
- VS Code installed
- Extension development dependencies installed (`npm install`)

## Debugging Setup

1. Open the project in VS Code
2. Press `F5` or select `Run > Start Debugging` from the menu
3. A new VS Code window will open with your extension loaded

## Debug Configuration

The project includes a default debug configuration in `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/out/**/*.js"
            ],
            "preLaunchTask": "npm: watch"
        }
    ]
}
```

## Debug Features

- Set breakpoints in your TypeScript files
- Use the Debug Console to evaluate expressions
- View variables in the Debug sidebar
- Step through code execution

## Common Debug Scenarios

1. **Extension Activation**
   - Set breakpoints in `extension.ts` to debug activation
   - Check the Debug Console for activation logs

2. **Webview Communication**
   - Set breakpoints in message handlers
   - Use the Debug Console to inspect message payloads

3. **React Component Debugging**
   - Use React Developer Tools in the debug window
   - Set breakpoints in `chat.tsx` for component lifecycle events

## Troubleshooting

- If breakpoints aren't hit, ensure source maps are generated
- Check the Debug Console for compilation errors
- Verify the extension is properly activated in the debug window

## Additional Resources

- [VS Code Extension Debugging Documentation](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [TypeScript Debugging Guide](https://code.visualstudio.com/docs/typescript/typescript-debugging) 