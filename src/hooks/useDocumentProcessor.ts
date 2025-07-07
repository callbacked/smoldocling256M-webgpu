import { useState, useEffect, useRef, useCallback } from 'react';
import { docTagsToMarkdown, docTagsToJSON } from '../utils/helpers';
import type { Region } from '../types/document.ts';

interface UseDocumentProcessorProps {
  pageImages: string[];
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  selectedRegion: Region | null;
  getImageMetrics: () => {
    renderedWidth: number;
    renderedHeight: number;
    offsetX: number;
    offsetY: number;
    naturalWidth: number;
    naturalHeight: number;
  } | null;
  selectedPrompt: { value: string; label: string };
  outputFormat: 'markdown' | 'json' | 'raw';
}

export const useDocumentProcessor = ({
  pageImages,
  totalPages,
  currentPage,
  setCurrentPage,
  selectedRegion,
  getImageMetrics,
  selectedPrompt,
  outputFormat,
}: UseDocumentProcessorProps) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'processing' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [results, setResults] = useState<string[]>([]);
  const [rawResults, setRawResults] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingOutput, setStreamingOutput] = useState<string>('');
  const [animatedTokens, setAnimatedTokens] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);

  const processCurrentPage = useCallback(async () => {
    if (!workerRef.current || !pageImages[currentPage]) return;

    setMessage(`Processing...`);
    setIsStreaming(true);
    setStreamingOutput('');
    setAnimatedTokens([]);

    let imageToProcess = pageImages[currentPage];
    let promptToSend = selectedPrompt.value;

    if (selectedRegion) {
      const metrics = getImageMetrics();
      if (!metrics) {
        setErrorMessage("Could not get image metrics to process region.");
        setStatus('error');
        return;
      }
      const { renderedWidth, renderedHeight, naturalWidth, naturalHeight } = metrics;
      const scaleX = naturalWidth / renderedWidth;
      const scaleY = naturalHeight / renderedHeight;
      const x1 = Math.round(selectedRegion.x * scaleX);
      const y1 = Math.round(selectedRegion.y * scaleY);
      const cropWidth = Math.round(selectedRegion.width * scaleX);
      const cropHeight = Math.round(selectedRegion.height * scaleY);

      try {
        imageToProcess = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;
            const ctx = cropCanvas.getContext('2d');
            if (!ctx) return reject(new Error("Failed to get canvas context for cropping."));
            ctx.drawImage(image, x1, y1, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            resolve(cropCanvas.toDataURL('image/png'));
          };
          image.onerror = () => reject(new Error("Image failed to load for cropping."));
          image.src = pageImages[currentPage];
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred during cropping.");
        setStatus('error');
        return;
      }
    }

    workerRef.current.postMessage({
      type: 'generate',
      data: { image: imageToProcess, prompt: promptToSend, stream: true },
    });
  }, [currentPage, getImageMetrics, pageImages, selectedPrompt, selectedRegion]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { status: workerStatus, data, output, numTokens, tps, token } = e.data;

      switch (workerStatus) {
        case 'loading':
          setStatus('loading');
          setMessage(data);
          break;
        case 'ready':
          setStatus('ready');
          setMessage('Model loaded. Ready to process image.');
          break;
        case 'start':
          setMessage('Processing page...');
          setIsStreaming(true);
          setStreamingOutput('');
          setAnimatedTokens([]);
          break;
        case 'update':
          setMessage(`Processing page ${currentPage + 1}/${totalPages} - Tokens: ${numTokens || 0} (${tps || 0} tokens/sec)`);
          break;
        case 'token':
          if (token) {
            setStreamingOutput(prev => prev + token);
            setAnimatedTokens(prev => [...prev, token]);
          }
          break;
        case 'complete':
          const rawResult = output[0];
          setRawResults(prev => {
            const newResults = [...prev];
            newResults[currentPage] = rawResult;
            return newResults;
          });

          const processedResult = outputFormat === 'markdown' ? docTagsToMarkdown(rawResult) : docTagsToJSON(rawResult);
          setResults(prev => {
            const newResults = [...prev];
            newResults[currentPage] = processedResult;
            return newResults;
          });

          setIsStreaming(false);

          if (currentPage < totalPages - 1) {
            setCurrentPage(prev => prev + 1);
          } else {
            setStatus('ready');
            setMessage('Finished processing document');
          }
          break;
        case 'error':
          setStatus('error');
          setErrorMessage(data);
          setIsStreaming(false);
          break;
        default:
          if ('percent' in e.data) {
            setProgress(e.data.percent);
          }
          break;
      }
    };

    workerRef.current.postMessage({ type: 'check' });
    workerRef.current.postMessage({ type: 'load' });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [currentPage, outputFormat, setCurrentPage, totalPages]);

  useEffect(() => {
    if (status === 'processing' && pageImages[currentPage]) {
      processCurrentPage();
    }
  }, [status, currentPage, pageImages, processCurrentPage]);

  const startProcessing = () => {
    if (pageImages.length > 0) {
      setStatus('processing');
      setCurrentPage(0);
      setResults(new Array(totalPages).fill(''));
      setRawResults(new Array(totalPages).fill(''));
      setAnimatedTokens([]);
    }
  };

  const cancelProcessing = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'interrupt' });
    }
    setStatus('ready');
    setIsStreaming(false);
    setMessage('Processing cancelled. Ready.');
  };

  const reset = () => {
    setStatus('idle');
    setMessage('');
    setResults([]);
    setRawResults([]);
    setProgress(0);
    setErrorMessage('');
    setIsStreaming(false);
    setStreamingOutput('');
    setAnimatedTokens([]);
  }

  return {
    status,
    message,
    results,
    rawResults,
    progress,
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
    reset,
  };
}; 