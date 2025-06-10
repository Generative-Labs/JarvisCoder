import {
  RiCodeSSlashFill,
  RiCheckLine,
  RiFileCopyLine,
  RiExpandUpDownLine,
  RiFileCodeLine,
  RiTerminalLine,
} from '@remixicon/react';
import React, { useCallback, useState } from 'react';
import { EventMessage } from '../../providers/chatEventMessage';
import { useVSCode } from '../../contexts/VSCodeContext';

const terminalLanguages = ['bash', 'sh', 'shell', 'zsh', 'powershell', 'cmd'];

export const RenderTopToolbar = React.memo(
  (props: {
    lang: string;
    attributes?: Record<string, string>;
    innerContent: string;
    isExpanded?: boolean;
    setIsExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
    showExpandButton?: boolean;
  }) => {
    const { lang, attributes, innerContent, isExpanded, setIsExpanded, showExpandButton } = props;
    const { vscode } = useVSCode();

    const handleOpenInTerminal = useCallback(
      (code: string) => {
        vscode.postMessage({
          type: EventMessage.OPEN_IN_TERMINAL,
          value: code,
        });
      },
      [vscode],
    );

    const handleAccept = useCallback(
      (path: string, content: string) => {
        vscode.postMessage({
          type: EventMessage.ACCEPT_ALL_CHANGES,
          value: JSON.stringify({
            leftFile: path,
            rightContent: content,
          }),
        });
      },
      [vscode],
    );

    const handleOpenDiff = useCallback(
      (path: string, content: string) => {
        vscode.postMessage({
          type: EventMessage.SHOW_CODE_DIFF,
          value: JSON.stringify({
            leftFile: path,
            rightContent: content,
          }),
        });
      },
      [vscode],
    );

    const [isCopied, setIsCopied] = useState(false);

    // render the Jarvis Tag
    const RenderJarvisTag = useCallback((props: { attributes: Record<string, string> }) => {
      const { attributes } = props;
      const kind = attributes?.kind || '';
      const path = attributes?.path || '';
      if (kind && kind !== 'write') {
        return (
          <div className="px-1 py-0.5 rounded inline-flex justify-center items-center gap-2.5">
            <RiTerminalLine size={16} className="text-ai-gray-01" />
            <div className="justify-start text-ai-gray-01 text-caption1 font-regular font-inter leading-[16px]">
              {kind || 'Run this command'}
            </div>
          </div>
        );
      }
      if (path) {
        return (
          <div className="flex justify-between items-center w-full">
            <div className="inline-flex justify-start items-center gap-1.5">
              <RiFileCodeLine size={16} className="text-ai-gray-01" />
              <div className="px-1 py-0.5 bg-success-bg rounded inline-flex justify-center items-center gap-2.5">
                <div className="justify-start text-white text-caption1 font-medium font-inter leading-[16px]">
                  {path ? path : 'Untitled-1'}
                </div>
              </div>
            </div>
          </div>
        );
      }
      return null;
    }, []);

    return (
      <div className="code-top-toolbar w-full absolute top-0 left-0 self-stretch px-2 py-1.5 bg-ai-bg-01 inline-flex justify-between items-center">
        <div className="flex justify-start items-center gap-1.5">
          {attributes ? (
            <RenderJarvisTag attributes={attributes || {}} />
          ) : (
            lang && (
              <div className="inline-flex justify-start items-center gap-1.5">
                <RiCodeSSlashFill size={12} className="text-ai-gray-01" />
                <div className="justify-start text-ai-gray-01 text-caption1 font-regular font-inter leading-none">
                  {lang}
                </div>
              </div>
            )
          )}
        </div>
        <div className="flex justify-end items-center gap-3">
          {lang && terminalLanguages.includes(lang.toLowerCase()) && (
            <button
              className=" p-0 bg-transparent hover:bg-transparent rounded inline-flex justify-center items-center gap-2.5  hover:text-ai-gray-01  text-caption1 font-regular font-inter
               text-ai-gray-05 
              "
              onClick={() => handleOpenInTerminal && handleOpenInTerminal(innerContent)}
              title="Run in terminal"
            >
              Run
            </button>
          )}
          {attributes?.path && attributes?.kind === 'write' && (
            <div className="flex items-center gap-3 ml-auto">
              <button
                className="hover:opacity-70 text-ai-gray-01 bg-ai-bg-02 hover:text-ai-gray-01 text-caption1 font-regular font-inter
                px-1 py-0.5 rounded inline-flex justify-center items-center gap-2.5
                "
                onClick={() =>
                  handleOpenDiff && handleOpenDiff(attributes?.path || '', innerContent)
                }
              >
                Open Diff
              </button>

              <button
                className="hover:opacity-70 text-ai-gray-01 bg-ai-bg-02 hover:text-ai-gray-01 text-caption1 font-regular font-inter
                px-1 py-0.5 rounded inline-flex justify-center items-center gap-2.5
                "
                onClick={() => handleAccept && handleAccept(attributes?.path || '', innerContent)}
              >
                Accept
              </button>
            </div>
          )}
          <button
            className="p-0 bg-transparent hover:bg-transparent  text-ai-gray-05 hover:text-ai-gray-01"
            onClick={() => {
              if (isCopied) return;
              navigator.clipboard.writeText(innerContent);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 5000);
            }}
            title="copy"
          >
            {isCopied ? <RiCheckLine size={16} /> : <RiFileCopyLine size={16} />}
          </button>
          {showExpandButton && (
            <button
              className="p-0 bg-transparent hover:bg-transparent  text-ai-gray-05 hover:text-ai-gray-01"
              onClick={() => setIsExpanded?.((prev) => !prev)}
              title={isExpanded ? 'collapse' : 'expand'}
            >
              <RiExpandUpDownLine size={16} />
            </button>
          )}
        </div>
      </div>
    );
  },
);
