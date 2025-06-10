/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext, useState, useMemo } from 'react';

import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as prismStyles from 'react-syntax-highlighter/dist/esm/styles/prism';
// Ensure vscode API is available

export interface ThemeInfo {
	name: string;
	isDark: boolean;
	isLight: boolean;
}

interface ThemeContextType {
	themeInfo: ThemeInfo | null;
	setThemeInfo: (themeInfo: ThemeInfo | null) => void;
	getSyntaxStyle: any;
}

const THEME_STYLE_MAP: Record<string, any> = {
	// popular third-party themes
	'One Dark Pro': prismStyles.oneDark,
	'Material Theme': prismStyles.materialDark,
	'Dracula Theme': prismStyles.dracula,
	Monokai: prismStyles.okaidia, // Monokai style
	'Solarized Light': prismStyles.solarizedlight, // need to check if there is a corresponding
	'Atom One Dark': prismStyles.oneDark,
	'Atom One Light': prismStyles.oneLight,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [themeInfo, setThemeInfo] = useState<ThemeInfo | null>(null);

	const getSyntaxStyle = useMemo(() => {
		if (!themeInfo) {
			return vscDarkPlus;
		}

		const map = THEME_STYLE_MAP[themeInfo.name];
		if (!map) {
			return themeInfo.isDark ? vscDarkPlus : oneLight;
		}

		return map;
	}, [themeInfo]);

	// Update themeInfo when themeInfo changes
	return (
		<ThemeContext.Provider
			value={{
				themeInfo,
				setThemeInfo,
				getSyntaxStyle,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = (): ThemeContextType => {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error('useTheme must be used within an ThemeProvider');
	}
	return context;
};
