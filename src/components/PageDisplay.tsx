import React from 'react';
import type { Region } from '../types/document.ts';

interface PageDisplayProps {
  pageImages: string[];
  currentPage: number;
  isSelectingRegion: boolean;
  handleMouseUp: (e: React.MouseEvent<HTMLImageElement>) => void;
  handleMouseDown: (e: React.MouseEvent<HTMLImageElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLImageElement>) => void;
  imageRef: React.RefObject<HTMLImageElement | null>;
  selectedRegion: Region | null;
  getImageMetrics: () => {
    renderedWidth: number;
    renderedHeight: number;
    offsetX: number;
    offsetY: number;
    naturalWidth: number;
    naturalHeight: number;
  } | null;
}

export const PageDisplay: React.FC<PageDisplayProps> = ({
  pageImages,
  currentPage,
  isSelectingRegion,
  handleMouseUp,
  handleMouseDown,
  handleMouseMove,
  imageRef,
  selectedRegion,
  getImageMetrics,
}) => {
  if (!pageImages[currentPage]) return <div className="empty-state">No image available</div>;

  const metrics = getImageMetrics();
  const imageEl = imageRef.current;

  return (
    <div 
      className={`page-image-container ${isSelectingRegion ? 'region-selection-active' : ''}`}
      style={{ position: 'relative' }}
      onMouseLeave={() => {
        if (isSelectingRegion && handleMouseUp) {
          handleMouseUp({ stopPropagation: () => {} } as React.MouseEvent<HTMLImageElement>);
        }
      }}
    >
      <img 
        ref={imageRef}
        src={pageImages[currentPage]} 
        alt={`Page ${currentPage + 1}`} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ userSelect: 'none' }}
      />
      {selectedRegion && metrics && imageEl && (
        <div 
          className="selected-region"
          style={{
            position: 'absolute',
            left: `${imageEl.offsetLeft + selectedRegion.x + metrics.offsetX}px`,
            top: `${imageEl.offsetTop + selectedRegion.y + metrics.offsetY}px`,
            width: `${selectedRegion.width}px`,
            height: `${selectedRegion.height}px`,
          }}
        />
      )}
      {isSelectingRegion && <div className="region-selection-helper">Click and drag to select a region</div>}
    </div>
  );
}; 