import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import {
  extractFormulaContent,
  extractCodeContent,
  otslToHTML,
} from '../utils/helpers';

interface ResultDisplayProps {
  isStreaming: boolean;
  streamingDivRef: React.RefObject<HTMLPreElement | null>;
  animatedTokens: string[];
  rawResults: string[];
  results: string[];
  currentPage: number;
  outputFormat: 'markdown' | 'json' | 'raw';
  selectedPrompt: { value: string; label: string };
  usedPrompts: { value: string; label: string }[];
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  isStreaming,
  streamingDivRef,
  animatedTokens,
  rawResults,
  results,
  currentPage,
  outputFormat,
  selectedPrompt,
  usedPrompts,
}) => {
  const [sanitizedCodeHtml, setSanitizedCodeHtml] = useState<string>('');
  const [sanitizedMarkdownHtml, setSanitizedMarkdownHtml] = useState<string>('');
  
  // Get the prompt that was used to generate the current page's content
  const promptUsedForCurrentPage = usedPrompts && usedPrompts[currentPage] 
    ? usedPrompts[currentPage] 
    : selectedPrompt; // Fall back to selected prompt if no used prompt is available
  
  // Process code content when needed
  useEffect(() => {
    if (outputFormat === 'markdown' && promptUsedForCurrentPage?.value === 'Convert code to text.') {
      const { code, language } = extractCodeContent(rawResults[currentPage] || '');
      const processCode = async () => {
        try {
          const html = await marked(`\`\`\`${language}\n${code}\n\`\`\``);
          setSanitizedCodeHtml(DOMPurify.sanitize(html));
        } catch (err: unknown) {
          console.error('Error processing code:', err);
          setSanitizedCodeHtml('<pre>Error processing code</pre>');
        }
      };
      processCode();
    }
  }, [outputFormat, promptUsedForCurrentPage?.value, rawResults, currentPage]);

  // Process general markdown content when needed
  useEffect(() => {
    if (outputFormat === 'markdown' && 
        promptUsedForCurrentPage?.value !== 'Convert formula to LaTeX.' && 
        !promptUsedForCurrentPage?.value?.includes('to OTSL') && 
        promptUsedForCurrentPage?.value !== 'Convert code to text.') {
      const processedContent = results[currentPage] || 'Not processed yet';
      const processMarkdown = async () => {
        try {
          const html = await marked(processedContent);
          setSanitizedMarkdownHtml(DOMPurify.sanitize(html));
        } catch (err: unknown) {
          console.error('Error processing markdown:', err);
          setSanitizedMarkdownHtml('<pre>Error processing markdown</pre>');
        }
      };
      processMarkdown();
    }
  }, [outputFormat, promptUsedForCurrentPage?.value, results, currentPage]);

  if (isStreaming) {
    return (
      <pre className="streaming-output" ref={streamingDivRef}>
        {animatedTokens.map((tok, i) => (
          <span key={i} className="fade-in-token">{tok}</span>
        ))}
        <span className="streaming-cursor"></span>
      </pre>
    );
  }

  const rawContent = rawResults[currentPage] || 'Not processed yet';
  const processedContent = results[currentPage] || 'Not processed yet';

  if (outputFormat === 'raw') return <pre>{rawContent}</pre>;

  if (outputFormat === 'markdown') {
    if (promptUsedForCurrentPage?.value === 'Convert formula to LaTeX.') {
      const formula = extractFormulaContent(rawContent);
      return <div className="latex-body"><BlockMath math={formula} /></div>;
    }
    if (promptUsedForCurrentPage?.value?.includes('to OTSL')) {
      const tableHtml = otslToHTML(rawContent);
      // Use DOMPurify as an additional layer of protection
      const sanitizedHtml = DOMPurify.sanitize(tableHtml);
      return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
    }
    if (promptUsedForCurrentPage?.value === 'Convert code to text.') {
      return <div className="code-body markdown-body" dangerouslySetInnerHTML={{ __html: sanitizedCodeHtml }} />;
    }
    
    return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: sanitizedMarkdownHtml }} />;
  }

  if (outputFormat === 'json') return <pre>{processedContent}</pre>;

  return null;
}; 