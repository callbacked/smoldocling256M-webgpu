import React, { useState, useEffect } from 'react';
import { UploadCloudIcon, CodeIcon, StructureIcon, LockIcon } from './Icons';

interface LandingPageProps {
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  handleDragOver,
  handleDrop,
  handleUploadClick,
  fileInputRef,
  handleFileChange,
}) => {
  const [isError, setIsError] = useState(false);
  const [wasError, setWasError] = useState(false);
  const [errorTimeout, setErrorTimeout] = useState<number | null>(null);
  
  useEffect(() => {
    return () => {
      if (errorTimeout !== null) {
        window.clearTimeout(errorTimeout);
      }
    };
  }, [errorTimeout]);

  const handleDropWithError = (e: React.DragEvent<HTMLDivElement>) => {
    if (errorTimeout !== null) {
      window.clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }

    handleDrop(e);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setIsError(true);
        setWasError(true); 
        
        const timeout = window.setTimeout(() => {
          setIsError(false);
        }, 1200); 
        
        setErrorTimeout(timeout);
      }
    }
  };

  return (
    <div className="landing-container">
      <div 
        className={`upload-zone ${isError ? 'upload-error' : ''} ${wasError ? 'was-error' : ''}`} 
        onDragOver={handleDragOver}
        onDrop={handleDropWithError}
        onClick={handleUploadClick}
      >
        <UploadCloudIcon className={isError ? 'error-icon' : ''} />
        <div className="upload-text">
          {isError ? 'Incompatible file type' : 'Drop your document image here'}
        </div>
        <div className="upload-hint">
          {isError ? 'Only PDF and image files are supported' : 'or click to browse files'}
        </div>
        <input 
          ref={fileInputRef}
          type="file" 
          id="file-upload" 
          accept="image/*,application/pdf" 
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
      
      <div className="features-section">
        <div className="feature-card" style={{ '--i': 1 } as React.CSSProperties}>
          <CodeIcon />
          <div className="feature-title">Intelligent Extraction</div>
          <div className="feature-description">Recognizes and extracts complex content like tables, math formulas, and code blocks.</div>
        </div>
        
        <div className="feature-card" style={{ '--i': 2 } as React.CSSProperties}>
          <StructureIcon />
          <div className="feature-title">Structured Output</div>
          <div className="feature-description">Convert images to structured Markdown or JSON, or more!</div>
        </div>
        
        <div className="feature-card" style={{ '--i': 3 } as React.CSSProperties}>
          <LockIcon />
          <div className="feature-title">Fully Offline</div>
          <div className="feature-description">Everything runs in your browser on-device. Your data never leaves your computer.</div>
        </div>
      </div>
    </div>
  );
}; 