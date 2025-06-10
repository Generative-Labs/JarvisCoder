/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
