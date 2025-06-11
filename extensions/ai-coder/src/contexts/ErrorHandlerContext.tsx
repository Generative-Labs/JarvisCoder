/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext, useState } from 'react';

import { ErrorMessage } from '../types/error';

interface ErrorHandlerContextType {
	error: ErrorMessage | null;
	setError: (error: ErrorMessage | null) => void;
}

const ErrorHandlerContext = createContext<ErrorHandlerContextType | undefined>(undefined);

export const ErrorHandlerProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [error, setError] = useState<ErrorMessage | null>(null);

	return (
		<ErrorHandlerContext.Provider
			value={{
				error,
				setError,
			}}
		>
			{children}
		</ErrorHandlerContext.Provider>
	);
};

export const useErrorHandler = (): ErrorHandlerContextType => {
	const context = useContext(ErrorHandlerContext);
	if (context === undefined) {
		throw new Error('useErrorHandler must be used within an ErrorHandlerProvider');
	}
	return context;
};
