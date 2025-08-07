import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import SimplePdfViewer from './SimplePdfViewer';
import SvgCanvas, { SvgElement } from './SvgCanvas';
import DrawingTools, { DrawingTool } from './DrawingTools';

interface DrawingCanvasProps {
  projectId: Id<"projects">;
  currentPage: number;
  onPageChange: (page: number) => void;
  currentStage?: string;
}

export default function DrawingCanvas({
  projectId,
  currentPage,
  onPageChange,
  currentStage = 'measurement',
}: DrawingCanvasProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [numPages, setNumPages] = useState(0);
  const [elements, setElements] = useState<SvgElement[]>([]);
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Получаем страницу проекта
  const pages = useQuery(api.projects.getProjectPages, { projectId });
  const currentPageData = pages?.find(page => page.pageNumber === currentPage);
  
  console.log('pages:', pages);
  console.log('pages content:', pages?.[0]);
  console.log('currentPage:', currentPage);
  console.log('currentPageData:', currentPageData);

  // Получаем SVG элементы из базы данных
  const dbElements = useQuery(
    api.svgElements.getSvgElements,
    currentPageData ? {
      pageId: currentPageData._id,
      stageType: currentStage as any,
    } : "skip"
  );

  // Мутации для работы с SVG элементами
  const createElement = useMutation(api.svgElements.createSvgElement);
  const updateElement = useMutation(api.svgElements.updateSvgElement);
  const deleteElement = useMutation(api.svgElements.deleteSvgElement);
  const clearElements = useMutation(api.svgElements.clearSvgElements);

  // Отслеживание размера контейнера
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Обработчики для PDF просмотрщика
  const handleScaleChange = useCallback((newScale: number) => {
    setScale(newScale);
  }, []);

  const handlePanChange = useCallback((newPan: { x: number; y: number }) => {
    setPan(newPan);
  }, []);

  const handleNumPagesChange = useCallback((pages: number) => {
    setNumPages(pages);
  }, []);

  // Синхронизация элементов из базы данных
  useEffect(() => {
    if (dbElements) {
      console.log('dbElements received:', dbElements);
      const convertedElements: SvgElement[] = dbElements.map(dbEl => ({
        id: dbEl._id,
        type: dbEl.elementType,
        data: dbEl.data,
        style: dbEl.style,
      }));
      console.log('Converted elements:', convertedElements);
      setElements(convertedElements);
    }
  }, [dbElements]);

  // Обработчики для SVG Canvas
  const handleElementsChange = useCallback(async (newElements: SvgElement[]) => {
    console.log('handleElementsChange called with:', newElements.length, 'elements');
    console.log('currentPageData:', currentPageData);
    
    // Временно используем первую страницу, если currentPageData не найден
    let targetPageData = currentPageData;
    if (!targetPageData && pages && pages.length > 0) {
      targetPageData = pages[0];
      console.log('Using first page as fallback:', targetPageData);
    }
    
    if (!targetPageData) {
      console.log('No page data available, returning');
      return;
    }

    console.log('Current elements:', elements.length);
    console.log('New elements:', newElements);

    // Находим новые элементы (которые начинаются с 'element_')
    const newElementsToCreate = newElements.filter(el => el.id.startsWith('element_'));
    console.log('Elements to create:', newElementsToCreate.length);
    
    // Создаем новые элементы в базе данных
    for (const element of newElementsToCreate) {
      console.log('Creating element:', element);
      await createElement({
        pageId: targetPageData._id,
        stageType: currentStage as any,
        elementType: element.type,
        data: element.data,
        style: element.style,
      });
    }

    console.log('Setting elements to:', newElements);
    setElements(newElements);
  }, [currentPageData, currentStage, createElement, elements]);

  const handleDrawingStart = useCallback(() => {
    setIsDrawing(true);
  }, []);

  const handleDrawingEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Обработчики для инструментов
  const handleToolSelect = useCallback((tool: DrawingTool) => {
    setSelectedTool(tool);
    setSelectedElementId(null); // Сброс выбора при смене инструмента
  }, []);



  const handleClearAll = useCallback(async () => {
    console.log('handleClearAll called');
    console.log('currentPageData:', currentPageData);
    console.log('pages:', pages);
    console.log('currentStage:', currentStage);
    
    // Временно используем первую страницу, если currentPageData не найден
    let targetPageData = currentPageData;
    if (!targetPageData && pages && pages.length > 0) {
      targetPageData = pages[0];
      console.log('Using first page as fallback for clear:', targetPageData);
    }
    
    if (!targetPageData) {
      console.log('No page data available for clear, just clearing local state');
      setElements([]);
      setSelectedElementId(null);
      return;
    }
    
    console.log('Clearing elements for page:', targetPageData._id);
    try {
      await clearElements({
        pageId: targetPageData._id,
        stageType: currentStage as any,
      });
      console.log('Clear elements mutation completed');
    } catch (error) {
      console.error('Error clearing elements:', error);
    }
    setElements([]);
    setSelectedElementId(null);
  }, [currentPageData, pages, currentStage, clearElements]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedElementId && !selectedElementId.startsWith('element_')) {
      await deleteElement({ elementId: selectedElementId as Id<"svgElements"> });
      setElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    } else if (selectedElementId) {
      // Удаляем элемент из локального состояния, если он еще не сохранен в БД
      setElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    }
  }, [selectedElementId, deleteElement]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected]);

  return (
    <div className="flex-1 flex flex-col bg-gray-100 h-full">
      {/* Верхняя панель с информацией */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Страница {currentPage} из {numPages}
          </span>
          <span className="text-sm text-gray-600">
            Масштаб: {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Элементов: {elements.length}
          </span>
          {selectedElementId && (
            <span className="text-sm text-blue-600">
              Выбран элемент
            </span>
          )}
        </div>
      </div>

      {/* Переключатель страниц - над всеми слоями */}
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
            Страница {currentPage} из {numPages}
          </span>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Следующая страница"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Масштаб: {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Левая панель - PDF просмотрщик с прозрачным SVG слоем поверх */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden min-h-0"
          style={{ minHeight: '500px' }}
        >
          {/* PDF просмотрщик как основной слой */}
          <div className="absolute inset-0">
            <SimplePdfViewer
              projectId={projectId}
              currentPage={currentPage}
              onPageChange={onPageChange}
              onScaleChange={handleScaleChange}
              onPanChange={handlePanChange}
              onNumPagesChange={handleNumPagesChange}
              disableMouseEvents={false}
            />
          </div>

          {/* Прозрачный SVG слой поверх PDF */}
          <div 
            className="absolute inset-0"
            style={{ 
              pointerEvents: selectedTool === 'select' ? 'none' : 'auto',
              zIndex: selectedTool === 'select' ? -1 : 10,
              opacity: selectedTool === 'select' ? 0 : 1,
              transition: 'opacity 0.2s ease-in-out',
              background: 'none',
              backgroundColor: 'transparent',
            }}
          >
            <SvgCanvas
              width={containerSize.width || 800}
              height={containerSize.height || 600}
              scale={scale}
              pan={pan}
              elements={elements}
              onElementsChange={handleElementsChange}
              selectedTool={selectedTool}
              isDrawing={isDrawing}
              onDrawingStart={handleDrawingStart}
              onDrawingEnd={handleDrawingEnd}
              onElementSelect={setSelectedElementId}
              selectedElementId={selectedElementId}
            />
          </div>
        </div>

        {/* Правая панель - инструменты */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <DrawingTools
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            onClearAll={handleClearAll}
            onDeleteSelected={handleDeleteSelected}
            hasSelectedElement={!!selectedElementId}
          />
          
          {/* Дополнительные настройки */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Настройки масштаба */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Настройки масштаба</h4>
                <div className="space-y-2">
                  <label className="block text-sm text-gray-700">
                    Известная длина (м)
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Длина в пикселях
                    <input
                      type="number"
                      step="1"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </label>
                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    Применить масштаб
                  </button>
                </div>
              </div>

              {/* Список элементов */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Элементы чертежа</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {elements.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет элементов</p>
                  ) : (
                    elements.map((element) => (
                      <div
                        key={element.id}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                          selectedElementId === element.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedElementId(element.id)}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <span className="text-sm text-gray-700">
                            {element.type} #{element.id.slice(-4)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setElements(prev => prev.filter(el => el.id !== element.id));
                            if (selectedElementId === element.id) {
                              setSelectedElementId(null);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 