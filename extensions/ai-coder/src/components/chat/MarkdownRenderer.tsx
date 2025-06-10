import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';
import '../../styles/markdown.css';
import { RiArrowUpSLine, RiArrowDownSLine } from '@remixicon/react';
import { RenderTopToolbar } from './MarkdownTopToolBar';
import { useTheme } from '../../contexts/ThemeContext';

interface MarkdownRendererProps {
  content: string;
  jarvisAttributes?: Record<string, string>;
  isInMessage?: boolean;
  language?: string;
  isTyping?: 'default' | 'typing' | 'done';
  hasSelectionCodes?: boolean;
  isThinking?: boolean;
}

const MarkdownRenderer = React.memo((props: MarkdownRendererProps) => {
  const {
    content,
    jarvisAttributes,
    language,
    isTyping = 'default',
    isInMessage = true,
    isThinking = false,
  } = props;
  const [isExpanded, setIsExpanded] = useState(isTyping === 'typing');
  const [thinkingContentExpanded, setThinkingContentExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { getSyntaxStyle } = useTheme();
  // empty content, not render
  if (!content.trim()) return null;
  // whether the content is a code block
  const isCodeContent = useMemo(() => content.trim().startsWith('```'), [content]);
  // whether the content is "thinking" content
  const isThinkingContent = useMemo(() => {
    if (!jarvisAttributes) {
      return false;
    }
    if (jarvisAttributes?.type === 'thinking') {
      return true;
    }
    if (jarvisAttributes?.type === 'think') {
      return true;
    }
    return false;
  }, [jarvisAttributes]);

  // extract the code content
  const codeContent = useMemo(() => {
    if (!isCodeContent) return '';

    const innerContent = content.split('\n').slice(1);
    const children = innerContent.join('\n');

    const code = String(children)
      .replace(/^```\w*\n/, '')
      .replace(/\n```$/, '')
      .replace(/```\n$/, '')
      .replace(/```$/, '')
      .replace(/\n$/, '');
    return code;
  }, [content, isCodeContent]);

  // only when the content changes, judge whether to show the expand button
  useEffect(() => {
    if (isCodeContent && contentRef.current) {
      const needExpand = contentRef.current.scrollHeight > 300;
      if (needExpand !== showExpandButton) setShowExpandButton(needExpand);
    }
    // eslint-disable-next-line
  }, [content, isCodeContent, showExpandButton]);
  // render the code block
  const CodeBlock = useMemo(
    () =>
      ({ inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        const lang = match ? match[1] : '';
        return !inline && match ? (
          <div
            className={` ${
              !isCodeContent &&
              `my-2 self-stretch relative w-full pt-8  border bg-ai-bg-03 inline-flex flex-col justify-start items-start overflow-hidden 
text-ai-gray-01 text-caption1 font-regular font-inter leading-[16px] rounded-[8px] border-code-block-border-color`
            }`}
          >
            {!isCodeContent && isInMessage && (
              <RenderTopToolbar lang={lang} attributes={jarvisAttributes} innerContent={children} />
            )}
            <div className="code-block-wrapper w-full overflow-auto custom-scrollbar py-2 px-3">
              <SyntaxHighlighter style={getSyntaxStyle} language={lang} PreTag="div" {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          </div>
        ) : (
          <code className="bg-ai-bg-03 px-1 text-ai-gray-01 text-caption1 font-regular font-inter  border-code-block-border-color">
            {children}
          </code>
        );
      },
    [getSyntaxStyle, isCodeContent, isInMessage, jarvisAttributes],
  );

  if (isCodeContent) {
    if (isThinkingContent) {
      return (
        <div className="thinking-content flex flex-col gap-2">
          <div
            className="flex items-center justify-start hover:cursor-pointer"
            onClick={() => setThinkingContentExpanded((prev) => !prev)}
          >
            <div className="text-ai-gray-05 text-caption1 font-regular font-inter">
              {isTyping === 'typing' && isThinking ? 'Thinking...' : 'Deep thinking completed'}
            </div>
            <div>
              {thinkingContentExpanded ? (
                <RiArrowUpSLine size={16} className="text-ai-gray-05" />
              ) : (
                <RiArrowDownSLine size={16} className="text-ai-gray-05" />
              )}
            </div>
          </div>

          {thinkingContentExpanded && (
            <div className="pl-[10px] border-l-[2px] text-ai-gray-05 text-caption1 font-regular font-inter border-solid border-ai-bg-04 overflow-auto custom-scrollbar">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{codeContent.trimStart()}</ReactMarkdown>
            </div>
          )}
        </div>
      );
    }
    return (
      <div
        className={` normalContainer text-ai-gray-01 self-stretch relative w-full pt-8  border bg-ai-bg-03 inline-flex flex-col justify-start items-start overflow-hidden 
text-caption1 font-regular font-inter leading-[16px] rounded-[8px] border-code-block-border-color
`}
      >
        {isInMessage && (
          <RenderTopToolbar
            lang={language || ''}
            attributes={jarvisAttributes}
            innerContent={codeContent}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            showExpandButton={showExpandButton}
          />
        )}
        <div
          ref={contentRef}
          className={`code-block-wrapper w-full no-scrollbar py-2 px-3 ${
            isExpanded ? 'max-h-none' : 'max-h-[300px] overflow-y-auto custom-scrollbar'
          }`}
        >
          {language === 'markdown' ? (
            <pre>{codeContent}</pre>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {content}
            </ReactMarkdown>
          )}
        </div>
        {showExpandButton && !isThinkingContent && (
          <div
            className="code-bottom-toolbar self-stretch px-3 py-2 bg-ai-bg-03  inline-flex justify-center items-center gap-1.5 cursor-pointer text-ai-gray-04 hover:text-ai-gray-01"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? <RiArrowUpSLine size={16} /> : <RiArrowDownSLine size={16} />}
          </div>
        )}
      </div>
    );
  } else {
    return (
      <div
        className={`text-block-wrapper overflow-x-auto common-text overflow-hidden no-scrollbar px-2 py-1.5 text-ai-gray-01 text-caption1 font-regular font-inter`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }
});

export default MarkdownRenderer;
