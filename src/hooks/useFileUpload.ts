import { useState, useCallback } from 'react';
import type { RefObject } from 'react';
import pdfjsLib from '../pdfjs-worker-setup';

export const useFileUpload = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);

  const renderPDF = useCallback(async (file: File) => {
    if (!canvasRef.current) throw new Error("Canvas is not available");
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context not available");

    const fileReader = new FileReader();

    fileReader.onload = async (event) => {
      if (!event.target?.result) return;
      
      const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument(typedArray).promise;

      setTotalPages(pdf.numPages);
      const newPageImages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
        newPageImages.push(canvas.toDataURL('image/png'));
      }
      setPageImages(newPageImages);
    };
    fileReader.readAsArrayBuffer(file);

  }, [canvasRef]);

  const processFile = useCallback(async (file: File) => {
    setImageFile(file);
    if (file.type.startsWith('image/')) {
      if (!canvasRef.current) {
        throw new Error("Canvas not available for file processing.");
      }
      
      try {
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = imageUrl;
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context not available");
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/png');
        
        setPageImages([imageDataUrl]);
        setTotalPages(1);
        
        URL.revokeObjectURL(imageUrl);
      } catch (error) {
        console.error("Failed to process image file:", error);
        throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (file.type === 'application/pdf') {
      try {
        await renderPDF(file);
      } catch (error) {
        console.error("Failed to process PDF file:", error);
        throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      throw new Error("Unsupported file type. Please upload an image or a PDF.");
    }
  }, [canvasRef, renderPDF]);

  const reset = useCallback(() => {
    setImageFile(null);
    setPageImages([]);
    setTotalPages(0);
  }, []);

  return {
    imageFile,
    pageImages,
    totalPages,
    processFile,
    reset,
  };
}; 