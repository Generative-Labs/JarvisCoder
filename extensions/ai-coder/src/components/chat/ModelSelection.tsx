/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';

interface ModelSelectionProps {
	selectedModel: string;
	setSelectedModel: (model: string) => void;
}

const ModelSelection: React.FC<ModelSelectionProps> = ({ selectedModel, setSelectedModel }) => {
	const displayModels = useMemo(() => {
		const models = [
			{
				name: 'Gemini 2.5 Pro',
				value: 'gemini-2.5-pro',
			},
			{
				name: 'Claude 3.7 Sonnet',
				value: 'claude-3.7-sonnet',
			},
			{
				name: 'Claude 4 Opus',
				value: 'claude-4-opus',
			},
			{
				name: 'Claude 4 Sonnet',
				value: 'claude-4-sonnet',
			},
			{
				name: 'GPT-4.1',
				value: 'gpt-4.1',
			},
			{
				name: 'Auto',
				value: '',
			},
		];
		const result: { name: string; value: string }[] = [];

		models.forEach((model, index) => {
			result.push({ name: model.name, value: model.value });
		});

		return result;
	}, []);

	const handleChangeModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedModel(e.target.value);
	};

	return (
		<div className="flex items-center gap-2 px-2 py-1.5 bg-ai-bg-02 border border-code-block-border-color hover:bg-ai-bg-03 text-ai-gray-01 hover:text-ai-gray-01 rounded-[6px] hover:cursor-pointer">
			<select
				value={selectedModel}
				onChange={handleChangeModel}
				className="bg-transparent text-ai-gray-05 hover:text-ai-gray-01 text-caption1 font-regular font-inter border-none focus:outline-none"
			>
				{displayModels.map((model) => (
					<option key={model.value} value={model.value} className="hover:cursor-pointer">
						{model.name}
					</option>
				))}
			</select>
		</div>
	);
};

export default ModelSelection;
