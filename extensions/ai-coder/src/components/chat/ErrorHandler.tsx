/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

import { RiInformationLine } from '@remixicon/react';
import { useAuth } from '../../contexts/AuthContext';

const ErrorHandler: React.FC = React.memo(() => {
	const { handleLogout } = useAuth();
	return (
		<div className="w-full px-5 mb-2">
			<div className="w-full p-4 bg-ai-bg-04 rounded-lg shadow-[0px_3px_9px_0px_rgba(0,0,0,0.40)] outline outline-1 outline-offset-[-1px] outline-ai-line-8% inline-flex flex-col justify-start items-end gap-3 overflow-hidden">
				<div className="self-stretch inline-flex justify-start items-start gap-2">
					<RiInformationLine className="w-4 h-5 leading-[20px] text-[16px] text-ai-gray-05 " />
					<div className="flex-1 justify-start text-ai-gray-01 text-body font-normal font-inter">
						Please note that, in accordance with our latest access policy, all users are now required to
						enter a valid invitation code to continue using this product.
					</div>
				</div>
				<div className="inline-flex justify-start items-center gap-1.5">
					<button
						className=" p-0 bg-transparent hover:bg-transparent rounded inline-flex justify-center items-center gap-2.5  hover:text-ai-gray-01  text-caption1 font-regular font-inter
				text-ai-gray-05
				"
						onClick={handleLogout}
						title="Logout"
					>
						Logout
					</button>
					<button
						className="hover:opacity-70 text-ai-gray-01 bg-ai-bg-02 hover:text-ai-gray-01 text-caption1 font-regular font-inter
				px-1.5 py-[3px] rounded inline-flex justify-center items-center gap-2.5
				"
						onClick={handleLogout}
					>
						Enter Invitation Code
					</button>
				</div>
			</div>
		</div>
	);
});

export default ErrorHandler;
