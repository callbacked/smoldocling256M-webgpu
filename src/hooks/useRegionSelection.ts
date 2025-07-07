import { useState, useCallback } from 'react';
import type { RefObject } from 'react';

export const useRegionSelection = (imageRef: RefObject<HTMLImageElement | null>) => {
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);

  const getImageMetrics = useCallback(() => {
    const image = imageRef.current;
    if (!image) {
      return null;
    }

    const { clientWidth, clientHeight, naturalWidth, naturalHeight } = image;
    const imageAspectRatio = naturalWidth / naturalHeight;
    const elementAspectRatio = clientWidth / clientHeight;

    let renderedWidth = clientWidth;
    let renderedHeight = clientHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspectRatio > elementAspectRatio) {
      renderedWidth = clientWidth;
      renderedHeight = clientWidth / imageAspectRatio;
      offsetY = (clientHeight - renderedHeight) / 2;
    } else {
      renderedHeight = clientHeight;
      renderedWidth = clientHeight * imageAspectRatio;
      offsetX = (clientWidth - renderedWidth) / 2;
    }
    
    return { renderedWidth, renderedHeight, offsetX, offsetY, naturalWidth, naturalHeight };
  }, [imageRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelectingRegion || !imageRef.current) return;
    
    const metrics = getImageMetrics();
    if (!metrics) return;

    const { renderedWidth, renderedHeight, offsetX, offsetY } = metrics;
    const rect = imageRef.current.getBoundingClientRect();
    
    const x = e.clientX - rect.left - offsetX;
    const y = e.clientY - rect.top - offsetY;
    
    if (x < 0 || y < 0 || x > renderedWidth || y > renderedHeight) {
      return;
    }
    
    setStartPoint({ x, y });
    setSelectedRegion({ x, y, width: 1, height: 1 });
    
    e.preventDefault();
  }, [isSelectingRegion, imageRef, getImageMetrics]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelectingRegion || !startPoint || !imageRef.current) return;
    
    const metrics = getImageMetrics();
    if (!metrics) return;

    const { renderedWidth, renderedHeight, offsetX, offsetY } = metrics;
    const rect = imageRef.current.getBoundingClientRect();
    
    let x = e.clientX - rect.left - offsetX;
    let y = e.clientY - rect.top - offsetY;

    x = Math.max(0, Math.min(x, renderedWidth));
    y = Math.max(0, Math.min(y, renderedHeight));
    
    setSelectedRegion({
      x: Math.min(startPoint.x, x),
      y: Math.min(startPoint.y, y),
      width: Math.abs(x - startPoint.x),
      height: Math.abs(y - startPoint.y)
    });
    
    e.preventDefault();
  }, [isSelectingRegion, startPoint, imageRef, getImageMetrics]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelectingRegion || !selectedRegion || !startPoint) return;
    
    e.stopPropagation();
    
    const finalRegion = { ...selectedRegion };

    if (finalRegion.width < 10 || finalRegion.height < 10) {
      setStartPoint(null);
      setSelectedRegion(null);
      return;
    }
    
    setIsSelectingRegion(false);
    setStartPoint(null);
  }, [isSelectingRegion, selectedRegion, startPoint]);
  
  const toggleRegionSelection = useCallback(() => {
    const wasSelecting = isSelectingRegion;
    setIsSelectingRegion(prev => !prev);

    if (wasSelecting || selectedRegion) {
      setSelectedRegion(null);
      setStartPoint(null);
    }
  }, [isSelectingRegion, selectedRegion]);

  return {
    isSelectingRegion,
    selectedRegion,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    toggleRegionSelection,
    getImageMetrics,
  };
}; 