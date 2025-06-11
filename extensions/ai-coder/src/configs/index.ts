/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

type Config = {
	API_BASE_URL: string;
	AUTH_URL: string;
	CLIENT_ID: string;
	BASE64_KEY: string;
};

const envConfigs: Record<string, Config> = {
	pre_production: {
		API_BASE_URL: 'https://jarvis-code-test.chakrachain.io',
		AUTH_URL: 'https://ai-training-web.vercel.app/login?client_id=client_01HSF00P0K7J8XNEXAMPLE',
		CLIENT_ID: 'client_01HSF00P0K7J8XNEXAMPLE',
		BASE64_KEY: 'KhMx3Q6FGbsZl0+qoHBwRstX+b63H5pZq/9tEYBlDmk=',
	},
	// production: {
	//   API_BASE_URL: 'https://jarvis-code.chakrachain.io',
	//   AUTH_URL: 'https://ai-training-web.vercel.app/login?client_id=client_01HSF00P0K7J8XNEXAMPLE',
	//   CLIENT_ID: 'client_01HSF00P0K7J8XNEXAMPLE',
	//   BASE64_KEY: 'KhMx3Q6FGbsZl0+qoHBwRstX+b63H5pZq/9tEYBlDmk=',
	// },
	development: {
		API_BASE_URL: 'https://jarvis-code-devnet.chakrachain.io',
		AUTH_URL:
			'http://ai-training-web-git-dev-s3labs.vercel.app/login?client_id=client_01HSF00P0K7J8XNEXAMPLE',
		CLIENT_ID: 'client_01HSF00P0K7J8XNEXAMPLE',
		BASE64_KEY: 'KhMx3Q6FGbsZl0+qoHBwRstX+b63H5pZq/9tEYBlDmk=',
	},
	local: {
		API_BASE_URL: 'https://jarvis-code-devnet.chakrachain.io',
		AUTH_URL: 'http://localhost:3000/login?client_id=client_01HSF00P0K7J8XNEXAMPLE',
		CLIENT_ID: 'client_01HSF00P0K7J8XNEXAMPLE',
		BASE64_KEY: 'KhMx3Q6FGbsZl0+qoHBwRstX+b63H5pZq/9tEYBlDmk=',
	},
};

const env = 'development'; // Change this to the desired environment
export const { API_BASE_URL, AUTH_URL, CLIENT_ID, BASE64_KEY } = envConfigs[env];
