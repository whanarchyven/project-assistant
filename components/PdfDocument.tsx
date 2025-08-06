import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Настройка worker для PDF.js через CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfDocumentProps {
  url: string;
  currentPage: number;
  scale: number;
  onPageChange: (page: number) => void;
  onDocumentLoadSuccess?: (numPages: number) => void;
}

export default function PdfDocument({
  url,
  currentPage,
  scale,
  onPageChange,
  onDocumentLoadSuccess,
}: PdfDocumentProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccessHandler = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
    onDocumentLoadSuccess?.(numPages);
  }, [onDocumentLoadSuccess]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Ошибка загрузки PDF:', error);
    setError('Ошибка загрузки PDF файла');
    setIsLoading(false);
  }, []);

  const onPageLoadSuccess = useCallback(() => {
    setIsLoading(false);
  }, []);

  const onPageLoadError = useCallback((error: Error) => {
    console.error('Ошибка загрузки страницы:', error);
    setError('Ошибка загрузки страницы');
    setIsLoading(false);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-center">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-lg font-medium">{error}</p>
          <p className="text-sm text-gray-600 mt-2">Попробуйте обновить страницу</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Загрузка PDF...</p>
          </div>
        </div>
      )}

      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccessHandler}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Загрузка документа...</p>
          </div>
        }
        error={
          <div className="text-center text-red-500">
            <p>Ошибка загрузки PDF</p>
          </div>
        }
      >
        {numPages > 0 && (
          <Page
            pageNumber={currentPage}
            scale={scale}
            onLoadSuccess={onPageLoadSuccess}
            onLoadError={onPageLoadError}
            loading={
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Загрузка страницы...</p>
              </div>
            }
            error={
              <div className="text-center text-red-500">
                <p>Ошибка загрузки страницы</p>
              </div>
            }
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        )}
      </Document>

      {/* Информация о страницах */}
      {numPages > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Страница {currentPage} из {numPages}
        </div>
      )}
    </div>
  );
} 