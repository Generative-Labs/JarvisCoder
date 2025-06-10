export interface UserInfo {
  uuid: string;
  email: string;
  name: string;
  avatar: string;
}

export interface TokenInfo {
  /** The access token */
  token: string;
  /** The refresh token */
  refreshToken: string;
  /** The expiration timestamp in milliseconds */
  expiresAt: number;
}
