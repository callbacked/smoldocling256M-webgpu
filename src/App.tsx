import { useState, useEffect, useRef } from 'react';
import './App.css';
import 'katex/dist/katex.min.css';
import {
  extractFormulaContent,
  extractCodeContent,
  docTagsToMarkdown,
  docTagsToJSON,
  otslToMarkdown,
} from './utils/helpers';
import { LandingPage } from './components/LandingPage';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { basePrompts } from './utils/prompts';
import { useRegionSelection } from './hooks/useRegionSelection';
import { useFileUpload } from './hooks/useFileUpload';
import { useDocumentProcessor } from './hooks/useDocumentProcessor';
import { GitHubIcon, HuggingFaceIcon } from './components/Icons';

function App() {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'json' | 'raw'>('markdown');
  const [prompts] = useState([...basePrompts]);
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0]);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [activePillStyle, setActivePillStyle] = useState({});
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingDivRef = useRef<HTMLPreElement>(null);
  const formatSelectorRef = useRef<HTMLDivElement>(null);
  const promptMenuRef = useRef<HTMLDivElement>(null);

  const { 
    imageFile, 
    pageImages, 
    totalPages, 
    processFile, 
  } = useFileUpload(canvasRef);

  const imageRef = useRef<HTMLImageElement>(null);
  const {
    isSelectingRegion,
    selectedRegion,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    toggleRegionSelection,
    getImageMetrics,
  } = useRegionSelection(imageRef);

  const {
    status,
    results,
    rawResults,
    usedPrompts,
    errorMessage,
    isStreaming,
    streamingOutput,
    animatedTokens,
    startProcessing,
    cancelProcessing,
    setResults,
    setRawResults,
    setStatus,
    setMessage,
    message,
  } = useDocumentProcessor({
    pageImages,
    totalPages,
    currentPage,
    setCurrentPage,
    selectedRegion,
    getImageMetrics,
    selectedPrompt,
    outputFormat,
  });

  useEffect(() => {
    const selector = formatSelectorRef.current;
    if (!selector) return;

    const active_button = selector.querySelector(`button[data-format="${outputFormat}"]`) as HTMLElement;

    if (active_button) {
      const { offsetLeft, offsetWidth } = active_button;
      setActivePillStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
      });
    }
  }, [outputFormat, imageFile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (promptMenuRef.current && !promptMenuRef.current.contains(event.target as Node)) {
        setIsPromptMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [promptMenuRef]);

  useEffect(() => {
    if (isStreaming && streamingDivRef.current) {
        streamingDivRef.current.scrollTop = streamingDivRef.current.scrollHeight;
      }
  }, [streamingOutput, isStreaming]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus('loading');
      setMessage('Loading image...');
      await processFile(file);
      setResults([]);
      setRawResults([]);
      setCurrentPage(0);
      setMessage('Image loaded. Ready to process.');
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
  };

  const downloadResults = () => {
    if (results.length === 0) return;
    

    const processedResults = results.map((result, index) => {
      const promptUsedForPage = usedPrompts && usedPrompts[index] 
        ? usedPrompts[index] 
        : selectedPrompt;
      
      if (outputFormat === 'raw') {
        return rawResults[index] || '';
      } else if (outputFormat === 'markdown') {
        if (promptUsedForPage.value === 'Convert formula to LaTeX.') {
          return extractFormulaContent(rawResults[index] || '');
        } else if (promptUsedForPage.value === 'Convert code to text.') {
          const { code } = extractCodeContent(rawResults[index] || '');
          return code;
        } else if (promptUsedForPage.value.includes('to OTSL')) {
          return otslToMarkdown(rawResults[index] || '');
        } else {
          return result || '';
        }
      } else {
        return result || '';
      }
    });
    
    const contentToDownload = processedResults.join('\n\n---\n\n');
    
    const blob = new Blob([contentToDownload], { 
      type: outputFormat === 'markdown' ? 'text/markdown' : 
            outputFormat === 'json' ? 'application/json' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${imageFile?.name || 'document'}.${
      outputFormat === 'markdown' ? 'md' : 
      outputFormat === 'json' ? 'json' : 'txt'
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const changeOutputFormat = (format: 'markdown' | 'json' | 'raw') => {
    setOutputFormat(format);
    
    if (rawResults.length > 0 && format !== 'raw') {
      const newResults = rawResults.map(raw => 
        format === 'markdown' ? docTagsToMarkdown(raw) : docTagsToJSON(raw)
      );
      setResults(newResults);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const syntheticEvent = {
        target: {
          files: e.dataTransfer.files,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        await handleFileChange(syntheticEvent);
      } else {
        setStatus('error');
        setMessage('Invalid file type. Please upload an image or a PDF.');
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const getStatusInfo = () => {
    switch (status) {
      case 'ready': return { text: 'Ready', className: 'ready' };
      case 'processing': {

        const tokenMatch = message.match(/Tokens: (\d+)/);
        const tpsMatch = message.match(/\((\d+(\.\d+)?) tokens\/sec\)/);
        
        const tokens = tokenMatch ? tokenMatch[1] : '0';
        const tps = tpsMatch ? tpsMatch[1] : '0';
        
        if (tokens === '0' || message === 'Processing page...' || !tokenMatch) {
          return { text: 'Starting...', className: 'processing' };
        }
        
        return { 
          text: `${tokens} tokens (${tps} tok/s)`, 
          className: 'processing' 
        };
      }
      case 'loading': return { text: 'Loading...', className: '' };
      case 'error': return { text: 'Error', className: 'error' };
      default: return { text: 'Idle', className: '' };
    }
  };

  const copyToClipboard = () => {
    let contentToCopy = '';
    
    const promptUsedForCurrentPage = usedPrompts && usedPrompts[currentPage] 
      ? usedPrompts[currentPage] 
      : selectedPrompt; 
    
    if (outputFormat === 'raw') {
      contentToCopy = rawResults[currentPage] || '';
    } else if (outputFormat === 'markdown') {
      if (promptUsedForCurrentPage.value === 'Convert formula to LaTeX.') {
        contentToCopy = extractFormulaContent(rawResults[currentPage] || '');
      } else if (promptUsedForCurrentPage.value === 'Convert code to text.') {
        const { code } = extractCodeContent(rawResults[currentPage] || '');
        contentToCopy = code;
      } else if (promptUsedForCurrentPage.value.includes('to OTSL')) {
        contentToCopy = otslToMarkdown(rawResults[currentPage] || '');
      } else {
        contentToCopy = results[currentPage] || '';
      }
    } else {
      contentToCopy = results[currentPage] || '';
    }
    
    navigator.clipboard.writeText(contentToCopy).then(() => {
        setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  };

  return (
    <div className="App">
      <header>
        <div className="header-content">
          <h1>SmolDocling 256M</h1>
          <p className="subtitle">Transform documents into structured, machine-readable text with WebGPU acceleration</p>
          <div className="header-links">
            <a href="https://github.com/callbacked/smoldocling256M-webgpu" target="_blank" rel="noreferrer" className="header-link">
              <GitHubIcon /> <span>Demo Repo</span>
            </a>
            <a href="https://huggingface.co/ds4sd/SmolDocling-256M-preview" target="_blank" rel="noreferrer" className="header-link">
              <HuggingFaceIcon /> <span>Model card</span>
            </a>
          </div>
        </div>
      </header>
      
      <canvas ref={canvasRef} />

      <main>
        {!imageFile ? (
          <LandingPage
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleUploadClick={handleUploadClick}
            fileInputRef={fileInputRef}
            handleFileChange={handleFileChange}
          />
        ) : (
          <DocumentWorkspace
            isSelectingRegion={isSelectingRegion}
            toggleRegionSelection={toggleRegionSelection}
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            isStreaming={isStreaming}
            results={results}
            copyToClipboard={copyToClipboard}
            copySuccess={copySuccess}
            formatSelectorRef={formatSelectorRef}
            activePillStyle={activePillStyle}
            outputFormat={outputFormat}
            changeOutputFormat={changeOutputFormat}
            status={status}
            setStatus={setStatus}
            getStatusInfo={getStatusInfo}
            imageFile={imageFile}
            promptMenuRef={promptMenuRef}
            startProcessing={startProcessing}
            cancelProcessing={cancelProcessing}
            selectedPrompt={selectedPrompt}
            usedPrompts={usedPrompts}
            selectedRegion={selectedRegion}
            isPromptMenuOpen={isPromptMenuOpen}
            setIsPromptMenuOpen={setIsPromptMenuOpen}
            prompts={prompts}
            setSelectedPrompt={setSelectedPrompt}
            downloadResults={downloadResults}
            handleFileChange={handleFileChange}
            errorMessage={errorMessage}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            pageImages={pageImages}
            getImageMetrics={getImageMetrics}
            imageRef={imageRef}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
            streamingDivRef={streamingDivRef}
            animatedTokens={animatedTokens}
            rawResults={rawResults}
          />
        )}
      </main>
    </div>
  );
}

export default App;
