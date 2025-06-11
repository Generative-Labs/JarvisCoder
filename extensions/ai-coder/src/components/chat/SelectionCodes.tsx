/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';

import { RiFileCodeLine, RiCloseLine } from '@remixicon/react';

import { useVSCode } from '../../contexts/VSCodeContext';
import { EventMessage } from '../../providers/chatEventMessage';
import { SelectedTextMessageValue } from '../../types/chats';

interface SelectionCodesProps {
	selectionCodes: SelectedTextMessageValue[];
	onRemoveCode?: (index: number) => void;
	disableClose?: boolean;
}

const SelectionCodes: React.FC<SelectionCodesProps> = ({
	selectionCodes,
	onRemoveCode,
	disableClose = false,
}) => {
	const { vscode } = useVSCode();

	if (selectionCodes.length === 0) {
		return null;
	}

	const displayPaths = useMemo(() => {
		const paths = selectionCodes.map((code) => code.fileInfo.path);
		const result: string[] = [];

		paths.forEach((path, index) => {
			const parts = path.split('/');
			const fileName = parts[parts.length - 1];

			const sameNameFiles = paths.filter((p, i) => {
				const pParts = p.split('/');
				return i !== index && pParts[pParts.length - 1] === fileName;
			});

			// check if the same name files are from different parent directories
			const hasDifferentParents = sameNameFiles.some((p) => {
				const pParts = p.split('/');
				return pParts[pParts.length - 2] !== parts[parts.length - 2];
			});

			// if there are same name files from different parent directories, display the parent directory
			const displayPath = hasDifferentParents ? `${parts[parts.length - 2]}/${fileName}` : fileName;

			result.push(displayPath);
		});

		return result;
	}, [selectionCodes]);

	const handleClick = (code: SelectedTextMessageValue) => {
		vscode.postMessage({
			type: EventMessage.OPEN_FILE_AND_SELECT,
			value: {
				filePath: code.fileInfo.fullPath,
				startLine: code.fileInfo.startLine,
				endLine: code.fileInfo.endLine,
			},
		});
	};

	const handleRemove = (index: number, e: React.MouseEvent) => {
		e.stopPropagation();
		if (onRemoveCode) {
			onRemoveCode(index);
		}
	};

	return (
		<div className="flex flex-wrap gap-2 w-full justify-start items-center">
			{selectionCodes.map((code, index) => (
				<button
					key={index}
					onClick={() => handleClick(code)}
					className="group px-1.5 py-1 rounded outline outline-1 outline-offset-[-1px] outline-code-block-border-color inline-flex justify-start items-center gap-[5px] hover:opacity-70"
				>
					<div className="relative w-3 h-3">
						<RiFileCodeLine
							size={12}
							className={`text-ai-gray-01 text-caption1 font-regular absolute transition-opacity ${disableClose ? 'opacity-100' : 'group-hover:opacity-0'}`}
						/>
						{!disableClose && (
							<RiCloseLine
								size={12}
								className="text-ai-gray-01 hover:text-ai-gray-03 absolute opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => handleRemove(index, e)}
							/>
						)}
					</div>
					<div className="justify-start text-ai-gray-03 text-caption1 font-regular font-inter">
						{displayPaths[index]} ({code.fileInfo.startLine}-{code.fileInfo.endLine})
					</div>
				</button>
			))}
		</div>
	);
};

export default SelectionCodes;
