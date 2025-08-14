import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import PdfDocument from './PdfDocument';

interface SimplePdfViewerProps {
  projectId: Id<"projects">;
  currentPage: number;
  onPageChange: (page: number) => void;
  onScaleChange?: (scale: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
  onNumPagesChange?: (numPages: number) => void;
  disableMouseEvents?: boolean;
  controlledScale?: number;
}

export default function SimplePdfViewer({
  projectId,
  currentPage,
  onPageChange,
  onScaleChange,
  onPanChange,
  onNumPagesChange,
  disableMouseEvents = false,
  controlledScale,
}: SimplePdfViewerProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [numPages, setNumPages] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Получаем проект с URL для PDF файла
  const project = useQuery(api.projects.getProjectWithPdfUrl, { projectId });

  useEffect(() => {
    if (onScaleChange) {
      onScaleChange(scale);
    }
  }, [scale, onScaleChange]);

  // При внешнем управлении масштабом синхронизируем локальное состояние
  useEffect(() => {
    if (typeof controlledScale === 'number' && controlledScale > 0 && controlledScale !== scale) {
      setScale(controlledScale);
    }
  }, [controlledScale]);

  useEffect(() => {
    if (onPanChange) {
      onPanChange(pan);
    }
  }, [pan, onPanChange]);

  // Получаем URL для PDF из проекта
  const pdfUrl = project?.pdfUrl;

  // Обработчик успешной загрузки документа
  const handleDocumentLoadSuccess = useCallback((numPages: number) => {
    setNumPages(numPages);
    onNumPagesChange?.(numPages);
  }, [onNumPagesChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disableMouseEvents) return;
    
    if (e.button === 0) { // Левая кнопка мыши
      setIsDragging(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disableMouseEvents) return;
    
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (disableMouseEvents) return;
    
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Масштабирование
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, scale * delta));
      setScale(newScale);
    } else {
      // Панорамирование
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disableMouseEvents) return;
    
    e.preventDefault();
    switch (e.key) {
      case 'ArrowLeft':
        if (currentPage > 1) {
          onPageChange(currentPage - 1);
        }
        break;
      case 'ArrowRight':
        if (currentPage < numPages) {
          onPageChange(currentPage + 1);
        }
        break;
    }
  };

  if (!project || !pdfUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-200">
        <div className="text-gray-500">
          {!project ? 'Загрузка проекта...' : 'PDF файл не найден'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-200">
      {/* Область просмотра PDF */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ 
          cursor: disableMouseEvents ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          pointerEvents: disableMouseEvents ? 'none' : 'auto'
        }}
      >
        <div
          ref={pdfRef}
          className="absolute inset-0 flex items-start justify-start"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%'
          }}
        >
          <PdfDocument
            url={pdfUrl}
            currentPage={currentPage}
            scale={scale}
            onDocumentLoadSuccess={handleDocumentLoadSuccess}
          />
        </div>
      </div>
    </div>
  );
} 