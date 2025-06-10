/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';

interface LoginProps {
	vscode: any;
}

const Login: React.FC<LoginProps> = ({ vscode }) => {
	const [isLoading, setIsLoading] = useState(false);

	const handleOpenAuthPage = () => {
		setIsLoading(true);
		vscode.postMessage({
			type: 'start_auth',
		});
		setTimeout(() => {
			setIsLoading(false);
		}, 90000);
	};

	return (
		<div className="flex flex-col h-screen w-full bg-ai-bg-01 m-auto">
			<div className="flex flex-col items-center justify-center h-full gap-6">
				<div className="justify-start text-title2 font-medium text-ai-gray-01">Welcome to Al Chat</div>
				<div className="flex flex-col gap-4 w-80">
					<button
						disabled={isLoading}
						onClick={handleOpenAuthPage}
						className="px-4 py-3 bg-ai-primary-blue-01 text-white text-headline font-regular font-inter rounded-lg hover:opacity-70 transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed
			text-center justify-center items-center
			"
					>
						{isLoading ? 'Loading...' : 'Log in'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default Login;
