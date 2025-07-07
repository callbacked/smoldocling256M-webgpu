import React from 'react';
import { marked } from 'marked';
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
}) => {
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
    if (selectedPrompt.value === 'Convert formula to LaTeX.') {
      const formula = extractFormulaContent(rawContent);
      return <div className="latex-body"><BlockMath math={formula} /></div>;
    }
    if (selectedPrompt.value.includes('to OTSL')) {
      const tableHtml = otslToHTML(rawContent);
      return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: tableHtml }} />;
    }
    if (selectedPrompt.value === 'Convert code to text.') {
      const { code, language } = extractCodeContent(rawContent);
      const formattedCode = marked(`\`\`\`${language}\n${code}\n\`\`\``);
      return <div className="code-body markdown-body" dangerouslySetInnerHTML={{ __html: formattedCode }} />;
    }
    return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked(processedContent) }} />;
  }

  if (outputFormat === 'json') return <pre>{processedContent}</pre>;

  return null;
}; 