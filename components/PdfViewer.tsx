import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

interface PdfViewerProps {
  projectId: Id<"projects">;
  currentPage: number;
  onPageChange: (page: number) => void;
  onScaleChange?: (scale: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
}

export default function PdfViewer({
  projectId,
  currentPage,
  onPageChange,
  onScaleChange,
  onPanChange,
}: PdfViewerProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Получаем проект и страницы
  const project = useQuery(api.projects.getProject, { projectId });
  const pages = useQuery(api.projects.getProjectPages, { projectId });

  // Получаем URL для PDF файла
  const pdfUrl = project?.pdfFileId ? 
    `https://${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/api/storage/${project.pdfFileId}` : 
    null;

  useEffect(() => {
    if (onScaleChange) {
      onScaleChange(scale);
    }
  }, [scale, onScaleChange]);

  useEffect(() => {
    if (onPanChange) {
      onPanChange(pan);
    }
  }, [pan, onPanChange]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleZoomReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Левая кнопка мыши
      setIsDragging(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Масштабирование колесиком мыши
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, scale * delta));
      
      // Масштабирование относительно позиции мыши
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleRatio = newScale / scale;
        setPan(prev => ({
          x: mouseX - (mouseX - prev.x) * scaleRatio,
          y: mouseY - (mouseY - prev.y) * scaleRatio,
        }));
      }
      
      setScale(newScale);
    } else {
      // Панорамирование колесиком мыши
      setPan(prev => ({
        x: prev.x - e.deltaX * 0.5,
        y: prev.y - e.deltaY * 0.5,
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        e.preventDefault();
        handleZoomReset();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (pages && currentPage > 1) {
          onPageChange(currentPage - 1);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (pages && currentPage < pages.length) {
          onPageChange(currentPage + 1);
        }
        break;
    }
  };

  if (!project || !pages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Загрузка проекта...</div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500">Ошибка загрузки PDF файла</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {/* Панель инструментов */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Навигация по страницам */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Предыдущая страница"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-600">
            Страница {currentPage} из {pages.length}
          </span>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pages.length}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Следующая страница"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Масштабирование */}
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-600 hover:text-gray-900"
            title="Уменьшить (Ctrl + колесико мыши)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-600 hover:text-gray-900"
            title="Увеличить (Ctrl + колесико мыши)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          
          <button
            onClick={handleZoomReset}
            className="p-2 text-gray-600 hover:text-gray-900"
            title="Сбросить масштаб (0)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Область просмотра PDF */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-200"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={pdfRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center',
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="text-gray-500">Загрузка PDF...</div>
            </div>
          )}
          
          <iframe
            src={`${pdfUrl}#page=${currentPage}`}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            style={{ minWidth: '100%', minHeight: '100%' }}
          />
        </div>
      </div>

      {/* Подсказки */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Используйте колесико мыши для панорамирования, Ctrl + колесико для масштабирования</span>
          <span>Стрелки для навигации по страницам</span>
        </div>
      </div>
    </div>
  );
} 