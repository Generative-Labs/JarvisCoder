import { tokenManager } from "./tokenManager";
import { TokenInfo } from "../types/auth";

/**
 * Fetches a resource with an access token, automatically refreshing it if needed
 * @param {string} url - The URL to fetch
 * @param {RequestInit} [options={}] - Optional fetch options
 * @param {TokenInfo} [tokenInfo] - Optional token info to use instead of getting from token manager
 * @returns {Promise<Response>} The response from the server
 * @throws {Error} If the token refresh fails or the request is unauthorized
 */
export async function fetchWithToken(
  url: string,
  options: RequestInit = {},
  tokenInfo?: TokenInfo
): Promise<Response> {
  let token: string | null;

  if (tokenInfo) {
    // Use provided token info if available
    token = tokenInfo.token;
  } else {
    // Otherwise get token from token manager
    token = await tokenManager.refreshTokenIfNeeded();
  }

  if (!token) {
    throw new Error("refresh_token_expired");
  }

  // set headers
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  // send request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // if return 401, maybe token is expired, try refresh once
  if (response.status === 401) {
    // Only try to refresh if we're not using provided token info
    if (!tokenInfo) {
      // hard refresh token
      const newToken = await tokenManager.refreshTokenIfNeeded(undefined, true);

      if (!newToken) {
        throw new Error("refresh_token_expired");
      }

      // use new token to retry request
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, {
        ...options,
        headers,
      });
    } else {
      // If using provided token info and it's expired, just throw error
      throw new Error("token_expired");
    }
  }

  return response;
}
