import React, { useState, useRef, useEffect } from 'react';
import {
  DocumentIcon,
  PlayIcon,
  DownloadIcon,
  FileIcon,
  ResultIcon,
  CodeIconSmall,
  MarkdownIcon,
  JsonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CopyIcon,
  NewFileIcon,
  StopIcon,
  UploadCloudIcon,
} from './Icons';
import { PageDisplay } from './PageDisplay';
import { ResultDisplay } from './ResultDisplay';
import type { Region } from '../types/document.ts';

interface DocumentWorkspaceProps {
  isSelectingRegion: boolean;
  toggleRegionSelection: () => void;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  isStreaming: boolean;
  results: string[];
  copyToClipboard: () => void;
  copySuccess: boolean;
  formatSelectorRef: React.RefObject<HTMLDivElement | null>;
  activePillStyle: object;
  outputFormat: 'markdown' | 'json' | 'raw';
  changeOutputFormat: (format: 'markdown' | 'json' | 'raw') => void;
  status: 'idle' | 'loading' | 'ready' | 'processing' | 'error';
  getStatusInfo: () => { text: string; className: string };
  imageFile: File | null;
  promptMenuRef: React.RefObject<HTMLDivElement | null>;
  startProcessing: () => void;
  cancelProcessing: () => void;
  selectedPrompt: { value: string; label: string };
  usedPrompts: { value: string; label: string }[];
  selectedRegion: Region | null;
  isPromptMenuOpen: boolean;
  setIsPromptMenuOpen: (isOpen: boolean) => void;
  prompts: { value: string; label: string }[];
  setSelectedPrompt: (prompt: { value: string; label: string }) => void;
  downloadResults: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errorMessage: string;
  setStatus: React.Dispatch<React.SetStateAction<'idle' | 'loading' | 'ready' | 'processing' | 'error'>>;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;

  // Props for PageDisplay
  pageImages: string[];
  getImageMetrics: () => { renderedWidth: number; renderedHeight: number; offsetX: number; offsetY: number; naturalWidth: number; naturalHeight: number; } | null;
  imageRef: React.RefObject<HTMLImageElement | null>;
  handleMouseDown: (e: React.MouseEvent<HTMLImageElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLImageElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLImageElement>) => void;

  // Props for ResultDisplay
  streamingDivRef: React.RefObject<HTMLPreElement | null>;
  animatedTokens: string[];
  rawResults: string[];
}

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
  isSelectingRegion,
  toggleRegionSelection,
  totalPages,
  currentPage,
  setCurrentPage,
  isStreaming,
  results,
  copyToClipboard,
  copySuccess,
  formatSelectorRef,
  activePillStyle,
  outputFormat,
  changeOutputFormat,
  status,
  getStatusInfo,
  imageFile,
  promptMenuRef,
  startProcessing,
  cancelProcessing,
  selectedPrompt,
  usedPrompts,
  selectedRegion,
  isPromptMenuOpen,
  setIsPromptMenuOpen,
  prompts,
  setSelectedPrompt,
  downloadResults,
  handleFileChange,
  errorMessage,
  setStatus,
  handleDragOver,
  handleDrop,
  pageImages,
  getImageMetrics,
  imageRef,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  streamingDivRef,
  animatedTokens,
  rawResults,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  
  const [isCustomPromptVisible, setIsCustomPromptVisible] = useState(false);
  const [customPromptText, setCustomPromptText] = useState("");
  const customPromptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCustomPromptVisible && customPromptInputRef.current) {
      customPromptInputRef.current.focus();
    }
  }, [isCustomPromptVisible]);

  const handleCustomPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (customPromptText.trim()) {
      const promptText = customPromptText.trim();
      
      const displayLabel = promptText.length > 25 
        ? `"${promptText.substring(0, 25)}..."` 
        : `"${promptText}"`;
      
      const customPrompt = {
        value: promptText,
        label: displayLabel
      };
      
      setSelectedPrompt(customPrompt);
      setIsPromptMenuOpen(false);
      setIsCustomPromptVisible(false);
    }
  };

  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current !== null) {
        window.clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, []);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current += 1;
      
      if (dragLeaveTimeoutRef.current !== null) {
        window.clearTimeout(dragLeaveTimeoutRef.current);
        dragLeaveTimeoutRef.current = null;
      }
      
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current -= 1;
      
      if (dragCounterRef.current <= 0) {
        dragLeaveTimeoutRef.current = window.setTimeout(() => {
          setIsDraggingOver(false);
          dragCounterRef.current = 0;
        }, 100);
      }
    }
  };

  const handleDragOverCustom = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    handleDragOver(e);
    
    if (e.dataTransfer.types.includes('Files') && !isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDropWrapper = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    handleDrop(e);
  };

  useEffect(() => {
    let timeoutId: number | null = null;
    
    if (status === 'error') {
      timeoutId = window.setTimeout(() => {
        setStatus('ready');
      }, 5000); 
    }
    
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [status, setStatus]);

  return (
    <div 
      className="document-workspace"
      onDragOver={handleDragOverCustom}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
    >
      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <UploadCloudIcon />
            <p>Drop to upload</p>
          </div>
        </div>
      )}
      
      <div className="glass-card preview-container" style={{padding: 'var(--spacing-4)'}}>
        <div className="page-display">
          <div className="page-image">
            <div className="page-header">
              <h3><DocumentIcon /> Document Preview</h3>
              <div className="page-actions">
                <button 
                  className={`icon-button ${isSelectingRegion ? 'active' : ''}`}
                  onClick={toggleRegionSelection}
                  title="Select region for processing"
                  disabled={status === 'processing'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h18v18H3z"></path>
                    <path d="M9 3v18"></path>
                    <path d="M15 3v18"></path>
                    <path d="M3 9h18"></path>
                    <path d="M3 15h18"></path>
                  </svg>
                  {isSelectingRegion ? 'Cancel' : 'Select Region'}
                </button>
                
                {totalPages > 1 && (
                  <div className="page-navigation">
                    <button 
                      className="nav-button"
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeftIcon />
                    </button>
                    <div className="page-indicator">
                      {currentPage + 1}/{totalPages}
                    </div>
                    <button 
                      className="nav-button"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={currentPage === totalPages - 1}
                    >
                      <ChevronRightIcon />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <PageDisplay
              pageImages={pageImages}
              currentPage={currentPage}
              isSelectingRegion={isSelectingRegion}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              imageRef={imageRef}
              selectedRegion={selectedRegion}
              getImageMetrics={getImageMetrics}
            />
          </div>
          
          <div className="page-result">
            <div className="result-header">
              <h3><ResultIcon /> {isStreaming ? 'Generating Content...' : 'Extracted Content'}</h3>
              <div className="result-actions">
                {!isStreaming && results[currentPage] && (
                  <button 
                    className="icon-button" 
                    onClick={copyToClipboard} 
                    title="Copy to clipboard"
                  >
                    <CopyIcon /> {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
            
            <ResultDisplay
              isStreaming={isStreaming}
              streamingDivRef={streamingDivRef}
              animatedTokens={animatedTokens}
              rawResults={rawResults}
              results={results}
              currentPage={currentPage}
              outputFormat={outputFormat}
              selectedPrompt={selectedPrompt}
              usedPrompts={usedPrompts}
            />
          </div>
        </div>
      </div>
      
      <div className="floating-action-bar-container">
          <div className={`format-selector ${isPromptMenuOpen ? 'prompt-open' : ''}`} ref={formatSelectorRef}>
            <div className="format-selector-active-bg" style={activePillStyle}></div>
            <button
              data-format="markdown"
              onClick={() => changeOutputFormat('markdown')}
              className={outputFormat === 'markdown' ? 'active' : ''}
              disabled={isStreaming}
            >
              <MarkdownIcon /> MD
            </button>
            <button 
              data-format="json"
              onClick={() => changeOutputFormat('json')}
              className={outputFormat === 'json' ? 'active' : ''}
              disabled={isStreaming}
            >
              <JsonIcon /> JSON
            </button>
            <button 
              data-format="raw"
              onClick={() => changeOutputFormat('raw')}
              className={outputFormat === 'raw' ? 'active' : ''}
              disabled={isStreaming}
            >
              <CodeIconSmall /> RAW
            </button>
          </div>
        <div className={`floating-action-bar ${status === 'processing' ? 'processing-glow' : ''}`}>
          
          <div className={`status-pill ${getStatusInfo().className}`}>
            {getStatusInfo().text}
          </div>
          
          {imageFile && (
            <>
              <div className="divider"></div>
              <div className="file-info">
                <FileIcon />
                <div className="file-name">{imageFile.name}</div>
              </div>
            </>
          )}
          
          <div className="divider"></div>
          
          <div className="action-button-group" ref={promptMenuRef}>
            {status === 'processing' ? (
              <button 
                onClick={cancelProcessing} 
                className="primary cancel-button"
              >
                <StopIcon /> Cancel
              </button>
            ) : (
              <>
                <button 
                  onClick={startProcessing} 
                  disabled={!imageFile}
                  className="primary main-action"
                >
                  <PlayIcon /> {`${selectedPrompt.label}${selectedRegion ? ' (Selected Region)' : ''}`}
                </button>
                <button
                  onClick={() => setIsPromptMenuOpen(!isPromptMenuOpen)}
                  className="primary dropdown-trigger"
                >
                  <ChevronDownIcon />
                </button>
              </>
            )}

            {isPromptMenuOpen && status !== 'processing' && (
              <div className="prompt-menu">
                {isCustomPromptVisible ? (
                  <form onSubmit={handleCustomPromptSubmit} className="custom-prompt-form">
                    <input 
                      type="text"
                      ref={customPromptInputRef}
                      className="custom-prompt-input"
                      placeholder="Type your custom prompt..."
                      value={customPromptText}
                      onChange={(e) => setCustomPromptText(e.target.value)}
                      autoFocus
                    />
                    <div className="custom-prompt-buttons">
                      <button type="button" onClick={() => setIsCustomPromptVisible(false)} className="cancel-prompt-btn">
                        Cancel
                      </button>
                      <button type="submit" className="submit-prompt-btn" disabled={!customPromptText.trim()}>
                        Submit
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {prompts.map(p => (
                      <button 
                        key={p.value} 
                        className={selectedPrompt.value === p.value ? 'active' : ''}
                        onClick={() => {
                          setSelectedPrompt(p);
                          setIsPromptMenuOpen(false);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                    
                    {selectedPrompt && !prompts.some(p => p.value === selectedPrompt.value) && (
                      <button 
                        className="active current-custom-prompt"
                        onClick={() => {
                          setIsPromptMenuOpen(false);
                        }}
                      >
                        {selectedPrompt.label}
                      </button>
                    )}
                    
                    <button 
                      className="custom-prompt-btn"
                      onClick={() => {
                        setIsCustomPromptVisible(true);
                        setCustomPromptText("");
                      }}
                    >
                      {selectedPrompt && !prompts.some(p => p.value === selectedPrompt.value) 
                        ? "New Custom Prompt..." 
                        : "Custom Prompt..."}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className={`download-button-wrapper ${results.filter(Boolean).length > 0 ? 'visible' : ''}`}>
            <button 
              onClick={downloadResults} 
              disabled={results.filter(Boolean).length === 0}
              className="download-button icon-button"
              title="Download results"
            >
              <DownloadIcon />
            </button>
          </div>
          
          <div className="divider"></div>
          
          <label htmlFor="file-upload-2" className="file-upload-label icon-button">
            <NewFileIcon />
          </label>
          <input 
            type="file" 
            id="file-upload-2" 
            accept="image/*,application/pdf" 
            onChange={handleFileChange}
            disabled={status === 'processing'}
          />
        </div>
      </div>
      
      {status === 'error' && (
        <div className="error-box">
          <div className="error-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3>Incompatible File</h3>
          <h4>Only PDF and image files are supported</h4>
          <div className="error-message">
            {errorMessage.split('\n').map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 