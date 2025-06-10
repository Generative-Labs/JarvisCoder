/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { Fragment, useMemo, useState } from 'react';

import MarkdownRenderer from './MarkdownRenderer';
import SelectionCodes from './SelectionCodes';
import { Message } from '../../types/chats';
import { parseCommandString } from '../../utils/util';

interface MessageItemProps {
	message: Message;
	typingState: 'typing' | 'done';
	isThinking?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(
	({ message, typingState, isThinking }) => {
		// Special rendering for selected text
		if (message.isUser) {
			const hasSelectionCodes = useMemo(() => {
				if (message?.selectionCodes?.length && message.selectionCodes.length > 0) {
					return true;
				}
				return false;
			}, [message]);
			return (
				<div
					className={`user-message-block px-2 py-1.5 self-end max-w-[95%] overflow-hidden overflow-x-auto bg-ai-bg-03 rounded-[8px] outline outline-1 outline-offset-[-1px] outline-bubble-border text-caption1 font-regular font-inter   ${hasSelectionCodes ? ' inline-flex flex-col justify-start items-start gap-1.5' : ''}`}
				>
					{hasSelectionCodes && (
						<SelectionCodes disableClose={true} selectionCodes={message.selectionCodes || []} />
					)}
					<div className="whitespace-pre-wrap break-words w-full text-ai-gray-01 text-caption1 font-regular font-inter">
						{message.text}
					</div>
				</div>
			);
		}

		return (
			<div
				className={`${message.isUser ? 'self-end max-w-[95%]' : 'self-start max-w-[95%]'}
		${message.text.indexOf('```') !== -1 || message.text.indexOf(':::') !== -1 ? 'w-[95%]' : ''}
		`}
			>
				{message.text.indexOf(':::') !== -1 || message.text.indexOf('```') !== -1 ? (
					<div className="flex flex-col gap-4">
						{(() => {
							const result = [];
							const lines = message.text.split('\n');
							const isV2 = message.text.includes(':::');
							const tag = isV2 ? ':::' : '```';

							const stack: Array<{
								startLine: number;
								language: string;
								content: string;
							}> = [];
							let currentText = '';
							let tempRender = null;
							// handle the unclosed code block
							const hasUnclosedCodeBlock =
								lines.some((line) => line.startsWith(tag) && line.length > 3) &&
								!lines.some((line) => line.trimEnd() === tag);

							if (hasUnclosedCodeBlock) {
								lines.push(tag);
							}
							for (let i = 0; i < lines.length; i++) {
								const line = lines[i];
								if (line.startsWith(tag) && line.length > 3) {
									// code block start
									const language = line.slice(3).split(' ')[0];

									// handle the text before the code block
									if (currentText.trim()) {
										result.push(
											<MarkdownRenderer key={`text-${i}`} content={currentText} isTyping={typingState} />,
										);
										currentText = '';
									}

									// create a new code block
									stack.push({
										startLine: i,
										language,
										content: `\`\`\`${line.slice(tag.length)}\n`,
									});
								} else if (line.trimEnd() === tag) {
									// code block end
									if (stack.length > 0) {
										const lastBlock = stack[stack.length - 1];
										lastBlock.content += '```' + '\n';
										// render the current code block
										const firstLine = lines[lastBlock.startLine];
										const attributes = parseCommandString(firstLine);

										// if it is a nested code block, handle it as normal text
										if (stack.length > 1) {
											// add the content of the current code block to the parent code block
											const parentBlock = stack[stack.length - 2];
											parentBlock.content += lastBlock.content;
										} else {
											// the outermost code block, render directly
											result.push(
												<MarkdownRenderer
													key={`code-${lastBlock.startLine}`}
													content={lastBlock.content}
													jarvisAttributes={Object.keys(attributes).length > 0 ? attributes : undefined}
													language={lastBlock.language}
													isTyping={typingState}
													isThinking={isThinking}
												/>,
											);
										}

										stack.pop();
									}
								} else {
									// normal text or code block content
									if (stack.length > 0) {
										// add the content to the current code block
										const lastBlock = stack[stack.length - 1];
										if (isV2) {
											lastBlock.content += line.indexOf(':::') >= 0 ? line.replace(':::', '```') : line;
											lastBlock.content += '\n';
										} else {
											lastBlock.content += `${line}\n`;
										}
									} else {
										// normal text
										if (isV2) {
											currentText += line.indexOf(':::') >= 0 ? line.replace(':::', '```') : line;
											currentText += '\n';
										} else {
											currentText += `${line}\n`;
										}
									}
								}

								// real-time rendering logic (only keep the latest temporary rendering)
								if (typingState === 'typing') {
									if (stack.length === 1) {
										const lastBlock = stack[stack.length - 1];
										tempRender = (
											<MarkdownRenderer
												key={`code-typing-temp`}
												content={`${lastBlock.content}\`\`\``}
												language={lastBlock.language}
												isTyping={typingState}
												isThinking={isThinking}
											/>
										);
									} else if (stack.length === 0) {
										if (currentText) {
											tempRender = (
												<MarkdownRenderer
													key={`text-typing-temp`}
													content={currentText}
													isTyping={typingState}
												/>
											);
										} else {
											tempRender = null;
										}
									}
								}
							}

							// handle the remaining text
							if (currentText.trim()) {
								result.push(
									<MarkdownRenderer key="text-final" content={currentText} isTyping={typingState} />,
								);
							}

							// handle the unclosed code block

							if (stack.length > 0) {
								const lastBlock = stack[stack.length - 1];
								const firstLine = lines[lastBlock.startLine];
								const attributes = parseCommandString(firstLine.trimStart());

								result.push(
									<MarkdownRenderer
										key={`code-unclosed-${lastBlock.startLine}`}
										content={`${lastBlock.content}\`\`\``}
										jarvisAttributes={Object.keys(attributes).length > 0 ? attributes : undefined}
										language={lastBlock.language}
										isTyping={typingState}
										isThinking={isThinking}
									/>,
								);
							}

							// only push the latest real-time rendering content once, and avoid duplicating the last item
							if (typingState === 'typing' && tempRender) {
								const last = result[result.length - 1];
								if (
									!last ||
									(last.props && tempRender.props && last.props.content !== tempRender.props.content)
								) {
									result.push(tempRender);
								}
							}

							return result;
						})()}
					</div>
				) : (
					<MarkdownRenderer content={message.text} isTyping={typingState} />
				)}
			</div>
		);
	},
);

export default MessageItem;
