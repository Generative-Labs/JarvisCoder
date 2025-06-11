/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

const LoadingText = (props: { text: string; position?: 'left' | 'center' }) => {
	const { text, position = 'left' } = props;
	return (
		<div
			className={`self-stretch pr-12 inline-flex ${position === 'center' ? 'justify-center' : 'justify-start'} items-center gap-2.5  w-full`}
		>
			<div className="justify-start text-ai-gray-04 text-caption1 font-regular font-inter ">
				{text}
				<span className="generating-dots">
					<span className="dot">.</span>
					<span className="dot">.</span>
					<span className="dot">.</span>
				</span>
			</div>
		</div>
	);
};

export default LoadingText;
