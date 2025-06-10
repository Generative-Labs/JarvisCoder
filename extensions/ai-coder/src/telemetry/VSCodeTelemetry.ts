import * as os from 'os';

import * as vscode from 'vscode';

import { Logger } from '../utils/logger';

import { trackEvent, TELEMETRY_EVENTS } from './index';

/**
 * VSCode native event listener - monitors editor-level user behavior
 */
export class VSCodeTelemetry {
  private disposables: vscode.Disposable[] = [];
  private static instance: VSCodeTelemetry | null = null;
  private isActive = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): VSCodeTelemetry {
    if (!VSCodeTelemetry.instance) {
      VSCodeTelemetry.instance = new VSCodeTelemetry();
    }
    return VSCodeTelemetry.instance;
  }

  /**
   * Convert absolute path to path relative to home directory
   */
  private getRelativeToHomePath(absolutePath: string): string {
    const homeDir = os.homedir();
    if (absolutePath.startsWith(homeDir)) {
      return absolutePath.replace(homeDir, '$HOME');
    }
    return absolutePath;
  }

  /**
   * Start VSCode event monitoring
   */
  public start(context: vscode.ExtensionContext): void {
    if (this.isActive) {
      return;
    }

    this.subscribeToWorkspaceEvents();
    
    // Add all subscriptions to context
    this.disposables.forEach(disposable => {
      context.subscriptions.push(disposable);
    });

    this.isActive = true;
    Logger.info('VSCode Telemetry started');
  }

  /**
   * Subscribe to workspace events
   */
  private subscribeToWorkspaceEvents(): void {
    // Workspace folder changes - user opens/closes projects
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        trackEvent(TELEMETRY_EVENTS.WORKSPACE_CHANGED, {
          added_folders: event.added.length,
          removed_folders: event.removed.length,
          total_folders: vscode.workspace.workspaceFolders?.length || 0,
          workspace_paths: vscode.workspace.workspaceFolders?.map(folder => 
            this.getRelativeToHomePath(folder.uri.fsPath)
          ) || [],
          workspace_names: vscode.workspace.workspaceFolders?.map(folder => 
            folder.name || 'unnamed'
          ) || [],
          event_source: 'vscode_workspace'
        });
      })
    );

    // Initial workspace state recording
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      trackEvent(TELEMETRY_EVENTS.WORKSPACE_OPENED, {
        folder_count: vscode.workspace.workspaceFolders.length,
        workspace_paths: vscode.workspace.workspaceFolders.map(folder => 
          this.getRelativeToHomePath(folder.uri.fsPath)
        ),
        workspace_names: vscode.workspace.workspaceFolders.map(folder => 
          folder.name || 'unnamed'
        ),
        event_source: 'vscode_workspace_initial'
      });
    }
  }

  /**
   * Stop monitoring and clean up resources
   */
  public stop(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.isActive = false;
    Logger.info('VSCode Telemetry stopped');
  }

  /**
   * Get running status
   */
  public isRunning(): boolean {
    return this.isActive;
  }
} 