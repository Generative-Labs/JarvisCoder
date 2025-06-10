# Code Indexing System

The Code Indexing system provides contextual code indexing for the AI Training VS Code extension. It tracks files in the workspace, resolves imports, and provides relevant code context to the LLM for improved interactions.

## Architecture

The system follows a clear separation of concerns with these main components:

### Public API

- **CodeIndexing**: The main public API class that external code should interact with. It coordinates between the file tracking and backend communication components.

### Implementation Details

- **FileTracker**: Maintains MD5 hashes of files in the codebase and tracks changes to those files.
- **ImportResolver**: Resolves imports in different programming languages (JavaScript/TypeScript, Python, Solidity).
- **FileMetadataStore**: Handles persistence of file metadata.

## Features

- **File Tracking**: Monitors files in the workspace and detects changes.
- **Import Resolution**: Resolves imports in JavaScript/TypeScript, Python, and Solidity files.
- **Most Used Files**: Tracks the most frequently used files to prioritize relevant context.
- **Backend Sync**: Synchronizes code files with the backend service.
- **Gitignore Support**: Automatically respects .gitignore patterns
- **Performance Optimized**: Debounced file watching and batch processing
- **VSCode Integration**: Native file watchers and workspace management
- **Persistent Storage**: File metadata stored in VSCode's global state

## Indexing Modes

The system supports two indexing modes:

1. **Full Indexing**: Indexes all files in the workspace.
2. **Most Used Files**: Only tracks and indexes files that are actively used by the developer.

## Usage

### Basic Usage

```typescript
// Get the CodeIndexing instance
import { CodeIndexing } from './Indexing/CodeIndexing';

const codeIndexing = CodeIndexing.getInstance(context);
```

### Getting Code Context for LLM

```typescript
// Get context for the active editor
const context = await codeIndexing.getCodeContextForActiveEditor();

// Get context for a specific file
const fileContext = await codeIndexing.getCodeContextForFile('/path/to/file.js');

```

### Syncing with Backend

```typescript
// Sync files for a specific session
await codeIndexing.syncFilesForSession('session-id');
```

## Data Structures

### CodeFileContext

The main data structure for providing context to the LLM:

```typescript
interface CodeFileContext {
  // The primary file that the user is working with
  primaryFile: CodeFile;
  
  // Files that are imported by the primary file
  importedFiles: CodeFile[];
  
  // Optional selection range in the primary file
  selection?: vscode.Range;
}
```

### CodeFile

Represents a code file with its path and content:

```typescript
interface CodeFile {
  // Absolute path to the file
  path: string;
  
  // Relative path (from workspace root)
  relativePath: string;
  
  // Content of the file
  content: string;
  
  // Language ID of the file (e.g., 'typescript', 'python', 'solidity')
  languageId: string;
}
```

## Testing

Unit tests are available in the `test` directory:

- `codeContext.test.ts`: Tests for the ImportResolver and code context functionality.

Run tests using:

```bash
npm run test
```

## Core Components

### FileTracker
- Tracks file changes using MD5 hashes
- Integrates with GitignoreHandler for intelligent file filtering
- Provides efficient file watching with debouncing
- Maintains sync state with timestamps

### GitignoreHandler
- Parses .gitignore files in workspace folders
- Supports all standard gitignore patterns:
  - Simple patterns: `*.log`, `temp.txt`
  - Directory patterns: `node_modules/`, `dist/`
  - Root patterns: `/config`, `/build`
  - Nested patterns: `src/**/*.test.js`
  - Negation patterns: `!important.log` (basic support)
- Automatically watches for .gitignore changes
- Cross-platform path handling

### CodeIndexing
- High-level interface for file indexing
- Manages FileTracker lifecycle
- Provides event-driven file change notifications

### FileMetadataStore
- Persistent storage for file metadata
- Workspace-aware storage keys
- Efficient querying and updates

## Gitignore Pattern Support

The GitignoreHandler supports the following pattern types:

### Basic Patterns
```gitignore
# Comments are ignored
*.log          # Matches all .log files
temp.txt       # Matches specific file
node_modules   # Matches directory name anywhere
```

### Directory Patterns
```gitignore
build/         # Matches build directory
/dist/         # Matches dist directory at root only
src/**/test/   # Matches test directories under src
```

### Advanced Patterns
```gitignore
*.{js,ts}      # Multiple extensions
**/*.test.*    # Test files at any depth
!important.log # Negation (basic support)
```

## Configuration

File patterns are configured in `filePatterns.ts`:

```typescript
export const SOURCE_FILE_PATTERNS = [
  '**/*.{sol,ts,tsx,js,jsx,py,toml,gitmodules}',
  // Add more patterns as needed
];

export const EXCLUDED_DIRECTORIES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  // These are combined with .gitignore patterns
];
```

## Performance Considerations

- **Caching**: Gitignore patterns are cached with file modification time
- **Debouncing**: File changes are debounced to prevent excessive processing
- **Batch Processing**: Files are processed in batches for better performance
- **Selective Watching**: Only relevant file types are monitored

## Best Practices

1. **Always use .gitignore**: Place `.gitignore` files in workspace roots
2. **Specific patterns**: Use specific patterns rather than broad wildcards
3. **Directory trailing slash**: Use `directory/` for directory-specific patterns
4. **Test patterns**: Use the built-in pattern testing for validation

## Integration Example

```typescript
// In your extension's activate function
export async function activate(context: vscode.ExtensionContext) {
  try {
    const codeIndexing = new CodeIndexing(context);
    await codeIndexing.initialize();
    
    // File changes are now automatically filtered by .gitignore
    codeIndexing.onFileChanged(async (changedFiles) => {
      for (const file of changedFiles) {
        console.log(`Processing: ${file.path}`);
        // Process only files that pass gitignore filtering
      }
    });
    
    context.subscriptions.push(codeIndexing);
  } catch (error) {
    console.error('Failed to initialize code indexing:', error);
  }
}
```

## Debugging

Enable debug logging to see gitignore pattern matching:

```typescript
// Check loaded patterns
const patterns = gitignoreHandler.getLoadedPatterns();
console.log('Loaded gitignore patterns:', patterns);

// The logger will show pattern matching details
// Look for: "File path/to/file matches gitignore pattern: pattern"
```

This module provides a robust foundation for file tracking in VSCode extensions while respecting developer workflows through comprehensive gitignore support.
