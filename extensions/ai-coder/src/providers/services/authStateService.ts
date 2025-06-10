import * as vscode from 'vscode';

interface UserInfo {
  uuid?: string;
  email?: string;
  name?: string;
  avatar?: string;
}

interface TokenInfo {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthStateService {
  private static instance: AuthStateService;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get the instance of the AuthStateService
   * @param context - The extension context
   * @returns The instance of the AuthStateService
   */
  public static getInstance(context: vscode.ExtensionContext): AuthStateService {
    if (!AuthStateService.instance) {
      AuthStateService.instance = new AuthStateService(context);
    }
    return AuthStateService.instance;
  }

  public async saveUserInfo(userInfo: unknown): Promise<UserInfo> {
    const data = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo;
    const saveData = {
      ...data,
      avatar: `https://cdn.stamp.fyi/avatar/${data.name ?? 'user'}`,
    };
    await this.context.globalState.update('userSettings', saveData);
    return saveData;
  }

  public async saveTokenInfo(tokenInfo: unknown): Promise<TokenInfo> {
    const data = typeof tokenInfo === 'string' ? JSON.parse(tokenInfo) : tokenInfo;
    const saveData = {
      token: data.token,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    };
    await this.context.globalState.update('tokenSettings', saveData);
    return saveData;
  }

  public getUserInfo(): UserInfo | undefined {
    return this.context.globalState.get('userSettings');
  }

  public getTokenInfo(): TokenInfo | undefined {
    return this.context.globalState.get('tokenSettings');
  }

  public async clearUserInfo(): Promise<void> {
    await this.context.globalState.update('userSettings', undefined);
  }

  public async clearTokenInfo(): Promise<void> {
    await this.context.globalState.update('tokenSettings', undefined);
  }

  public async clearAllState(): Promise<void> {
    await this.clearUserInfo();
    await this.clearTokenInfo();
  }
}
