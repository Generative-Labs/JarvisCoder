import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { logger } from '../utils/logger';

/**
 * Represents a code file with its path and content
 */
export interface CodeFile {
  /**
   * Absolute path to the file
   */
  path: string;
  
  /**
   * Relative path (from workspace root)
   */
  relativePath: string;
  
  /**
   * Content of the file
   */
  content: string;
  
  /**
   * Language ID of the file (e.g., 'typescript', 'python', 'solidity')
   */
  languageId: string;
}

/**
 * Represents a context of code files for LLM processing
 */
export interface CodeFileContext {
  /**
   * The primary file that the user is working with
   */
  primaryFile: CodeFile;
  
  /**
   * Files that are imported by the primary file
   */
  importedFiles: CodeFile[];
  
  /**
   * Optional selection range in the primary file
   */
  selection?: vscode.Range;
}

/**
 * Utility class for resolving imports in different programming languages.
 * 
 * This is an internal implementation detail of the code indexing system.
 * External code should use the CodeIndexing class instead.
 */
export class ImportResolver {
  /**
   * Resolve imports for a file
   * @param {string} filePath - Absolute path to the file
   * @param {string} fileContent - Content of the file
   * @param {string} languageId - Language ID of the file
   * @returns {Promise<string[]>} List of absolute paths to imported files
   */
  public static async resolveImports(
    filePath: string,
    fileContent: string,
    languageId: string
  ): Promise<string[]> {
    try {
      switch (languageId) {
        case 'typescript':
        case 'javascript':
        case 'typescriptreact':
        case 'javascriptreact':
          return this.resolveJsImports(filePath, fileContent);
        case 'python':
          return this.resolvePythonImports(filePath, fileContent);
        case 'solidity':
          return this.resolveSolidityImports(filePath, fileContent);
        default:
          logger.warn(`Import resolution not supported for language: ${languageId}`);
          return [];
      }
    } catch (error) {
      logger.error(`Error resolving imports for ${filePath}:`, 
        error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Resolve JavaScript/TypeScript imports
   * @param {string} filePath - Absolute path to the file
   * @param {string} fileContent - Content of the file
   * @returns {string[]} List of absolute paths to imported files
   */
  private static resolveJsImports(filePath: string, fileContent: string): string[] {
    const importPaths: string[] = [];
    const baseDir = path.dirname(filePath);
    
    // Match ES6 imports: import ... from 'path'
    const es6ImportRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = es6ImportRegex.exec(fileContent)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        const resolvedPath = this.resolveLocalImportPath(baseDir, importPath, ['.ts', '.tsx', '.js', '.jsx']);
        if (resolvedPath) {
          importPaths.push(resolvedPath);
        }
      }
    }
    
    // Match CommonJS require: require('path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    while ((match = requireRegex.exec(fileContent)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        const resolvedPath = this.resolveLocalImportPath(baseDir, importPath, ['.ts', '.tsx', '.js', '.jsx']);
        if (resolvedPath) {
          importPaths.push(resolvedPath);
        }
      }
    }
    
    // Filter out null values and duplicates
    return [...new Set(importPaths.filter(Boolean) as string[])];
  }

  /**
   * Resolve Python imports
   * @param {string} filePath - Absolute path to the file
   * @param {string} fileContent - Content of the file
   * @returns {string[]} List of absolute paths to imported files
   */
  private static resolvePythonImports(filePath: string, fileContent: string): string[] {
    const importPaths: string[] = [];
    const baseDir = path.dirname(filePath);
    
    // Match Python imports: import module or from module import ...
    const importRegex = /^\s*import\s+([^\s]+)/gm;
    const fromImportRegex = /^\s*from\s+([^\s]+)\s+import/gm;
    
    let match;
    
    // Process 'import module' statements
    while ((match = importRegex.exec(fileContent)) !== null) {
      const moduleName = match[1];
      if (!this.isPythonBuiltinModule(moduleName)) {
        const resolvedPath = this.resolvePythonModulePath(baseDir, moduleName);
        if (resolvedPath) {importPaths.push(resolvedPath);}
      }
    }
    
    // Process 'from module import ...' statements
    while ((match = fromImportRegex.exec(fileContent)) !== null) {
      const moduleName = match[1];
      if (!this.isPythonBuiltinModule(moduleName) && moduleName !== '.') {
        const resolvedPath = this.resolvePythonModulePath(baseDir, moduleName);
        if (resolvedPath) {importPaths.push(resolvedPath);}
      }
    }
    
    // Filter out null values and duplicates
    return [...new Set(importPaths.filter(Boolean) as string[])];
  }

  /**
   * Resolve Solidity imports
   * @param {string} filePath - Absolute path to the file
   * @param {string} fileContent - Content of the file
   * @returns {string[]} List of absolute paths to imported files
   */
  private static resolveSolidityImports(filePath: string, fileContent: string): string[] {
    const importPaths: string[] = [];
    const baseDir = path.dirname(filePath);
    
    // Match Solidity imports: import "path" or import { symbols } from "path"
    const importRegex = /import\s+(?:(?:["']([^"']+)["'])|(?:[\w\s{},*]+\s+from\s+["']([^"']+)["']))/g;
    
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath) {
        const resolvedPath = this.resolveLocalImportPath(baseDir, importPath, ['.sol']);
        if (resolvedPath) {importPaths.push(resolvedPath);}
      }
    }
    
    // Filter out null values and duplicates
    return [...new Set(importPaths.filter(Boolean) as string[])];
  }

  /**
   * Check if an import path is a local import (not a package)
   * @param {string} importPath - Import path to check
   * @returns {boolean} True if the import is local
   */
  private static isLocalImport(importPath: string): boolean {
    return importPath.startsWith('./') || 
           importPath.startsWith('../') || 
           importPath.startsWith('/');
  }

  /**
   * Resolve a local import path to an absolute file path
   * @param {string} baseDir - Base directory to resolve from
   * @param {string} importPath - Import path to resolve
   * @param {string[]} extensions - Possible file extensions to try
   * @returns {string | null} Absolute path to the imported file or null if not found
   */
  private static resolveLocalImportPath(
    baseDir: string, 
    importPath: string, 
    extensions: string[]
  ): string | null {
    // If the import path already has an extension, try that first
    const hasExtension = extensions.some(ext => importPath.endsWith(ext));
    
    if (hasExtension) {
      const absolutePath = path.resolve(baseDir, importPath);
      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
    }
    
    // Try with each extension
    for (const ext of extensions) {
      const absolutePath = path.resolve(baseDir, `${importPath}${ext}`);
      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
      
      // Try with /index.ext
      const indexPath = path.resolve(baseDir, `${importPath}/index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
    
    // If we couldn't resolve with extensions, try the exact path
    const exactPath = path.resolve(baseDir, importPath);
    if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
      return exactPath;
    }
    
    logger.warn(`Could not resolve import: ${importPath} from ${baseDir}`);
    return null;
  }

  /**
   * Resolve a Python module path to an absolute file path
   * @param {string} baseDir - Base directory to resolve from
   * @param {string} moduleName - Python module name to resolve
   * @returns {string | null} Absolute path to the module file or null if not found
   */
  private static resolvePythonModulePath(baseDir: string, moduleName: string): string | null {
    // Handle relative imports
    if (moduleName.startsWith('.')) {
      const relativePath = moduleName.replace(/^\.+/, (dots) => 
        // For each dot, go up one directory
         '../'.repeat(dots.length - 1)
      );
      
      // Try with .py extension
      const pyPath = path.resolve(baseDir, `${relativePath}.py`);
      if (fs.existsSync(pyPath)) {
        return pyPath;
      }
      
      // Try as a directory with __init__.py
      const initPath = path.resolve(baseDir, `${relativePath}/__init__.py`);
      if (fs.existsSync(initPath)) {
        return initPath;
      }
    } else {
      // For non-relative imports, we'd need to search in the Python path
      // This is a simplified approach that just looks in the same directory and parent directories
      const pyPath = path.resolve(baseDir, `${moduleName}.py`);
      if (fs.existsSync(pyPath)) {
        return pyPath;
      }
      
      const initPath = path.resolve(baseDir, `${moduleName}/__init__.py`);
      if (fs.existsSync(initPath)) {
        return initPath;
      }
    }
    
    logger.warn(`Could not resolve Python module: ${moduleName} from ${baseDir}`);
    return null;
  }

  /**
   * Check if a Python module is a built-in module
   * @param {string} moduleName - Python module name to check
   * @returns {boolean} True if the module is a built-in module
   */
  private static isPythonBuiltinModule(moduleName: string): boolean {
    const builtinModules = [
      'os', 'sys', 'math', 'random', 'datetime', 're', 'json', 'collections',
      'itertools', 'functools', 'time', 'typing', 'pathlib', 'shutil', 'subprocess',
      'argparse', 'logging', 'io', 'csv', 'urllib', 'http', 'socket', 'email',
      'unittest', 'threading', 'multiprocessing', 'asyncio', 'concurrent'
    ];
    
    return builtinModules.includes(moduleName) || 
           moduleName.split('.')[0].startsWith('_');
  }
}
