import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import SimplePdfViewer from './SimplePdfViewer';
import SvgCanvas, { SvgElement } from './SvgCanvas';
import DrawingTools, { DrawingTool } from './DrawingTools';
import { useMemo } from 'react';

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
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPixels, setCalibrationPixels] = useState<number | null>(null);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Получаем страницу проекта
  const pages = useQuery(api.projects.getProjectPages, { projectId });
  const currentPageData = pages?.find(page => page.pageNumber === currentPage);
  const ensurePage = useMutation(api.projects.ensurePage);
  
  console.log('pages:', pages);
  console.log('pages content:', pages?.[0]);
  console.log('currentPage:', currentPage);
  console.log('currentPageData:', currentPageData);

  // Получаем SVG элементы из базы данных
  const dbElements = useQuery(
    api.svgElements.getSvgElements,
    currentPageData ? {
      pageId: currentPageData._id,
      stageType: currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
    } : "skip"
  );

  // Загружаем проект, чтобы узнать, есть ли уже калибровка
  const project = useQuery(api.projects.getProject, { projectId });

  // Мутация для сохранения калибровки
  const updateProjectScale = useMutation(api.projects.updateProjectScale);

  // Мутации для работы с SVG элементами
  const createElement = useMutation(api.svgElements.createSvgElement);
  // const updateElement = useMutation(api.svgElements.updateSvgElement);
  const deleteElement = useMutation(api.svgElements.deleteSvgElement);
  const clearElements = useMutation(api.svgElements.clearSvgElements);
  const updateCeilingHeight = useMutation(api.projects.updateCeilingHeight);

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

    // Следим за изменением размеров самого контейнера (внутренние перестройки без ресайза окна)
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) observer.disconnect();
    };
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

  // Если нет калибровки, запускаем режим калибровки (блокируем инструменты)
  useEffect(() => {
    if (project && !project.scale) {
      setIsCalibrating(true);
      setSelectedTool('line');
    }
  }, [project]);

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
    
    let pageId = currentPageData?._id;
    if (!pageId) {
      // Если страницы нет (например, из-за ленивой инициализации), гарантированно создадим
      pageId = await ensurePage({ projectId, pageNumber: currentPage });
    }

    console.log('Current elements:', elements.length);
    console.log('New elements:', newElements);

    // Находим новые элементы (которые начинаются с 'element_')
    const newElementsToCreate = newElements.filter(el => el.id.startsWith('element_'));

    // Вспомогательная функция вычисления длины линии в пикселях
    const computeLinePixels = (data: any): number | null => {
      if (Array.isArray(data?.points) && data.points.length >= 2) {
        let total = 0;
        for (let i = 0; i < data.points.length - 1; i++) {
          const a = data.points[i];
          const b = data.points[i + 1];
          if (
            typeof a?.x === 'number' && typeof a?.y === 'number' &&
            typeof b?.x === 'number' && typeof b?.y === 'number'
          ) {
            total += Math.hypot(b.x - a.x, b.y - a.y);
          }
        }
        return total;
      }
      const { x1, y1, x2, y2 } = data || {};
      if (
        typeof x1 === 'number' && typeof y1 === 'number' &&
        typeof x2 === 'number' && typeof y2 === 'number'
      ) {
        return Math.hypot(x2 - x1, y2 - y1);
      }
      return null;
    };

    // Если идет калибровка, перехватываем и разрешаем только ОДНУ линию
    if (isCalibrating) {
      // запретить любые не-линии
      if (newElementsToCreate.some(el => el.type !== 'line')) {
        const cleaned = newElements.filter(el => !el.id.startsWith('element_'));
        setElements(cleaned);
        return;
      }
      if (newElementsToCreate.length > 0) {
        const lastTemp = newElementsToCreate[newElementsToCreate.length - 1];
        const px = computeLinePixels(lastTemp.data);
        if (px && px > 0) {
          setCalibrationPixels(px);
          setCalibrationModalOpen(true);
        }
        // оставляем временную линию видимой до завершения калибровки
        setElements(newElements);
        return;
      }
    }
    
    // Если не в режиме калибровки, но пользователь рисует линию — запускаем перекалибровку
    if (!isCalibrating && selectedTool === 'line' && newElementsToCreate.length > 0) {
      const lastTemp = newElementsToCreate[newElementsToCreate.length - 1];
      const px = computeLinePixels(lastTemp.data);
      if (px && px > 0) {
        setCalibrationPixels(px);
        setIsRecalibrating(true);
        setCalibrationModalOpen(true);
      }
      // оставляем временную линию видимой до завершения перекалибровки
      setElements(newElements);
      return;
    }
    console.log('Elements to create:', newElementsToCreate.length);
    
    // Создаем новые элементы в базе данных
    for (const element of newElementsToCreate) {
      console.log('Creating element:', element);
      await createElement({
        pageId,
        stageType: currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
        elementType: element.type,
        data: element.data,
        style: element.style,
        semanticType: (currentStage === 'markup') ? (element.semanticType ?? ((selectedTool === 'room') ? 'room' : (selectedTool === 'door') ? 'door' : (selectedTool === 'window') ? 'window' : undefined)) : undefined,
      });
    }

    console.log('Setting elements to:', newElements);
    setElements(newElements);
  }, [currentPageData, currentStage, createElement, elements, isCalibrating, ensurePage, projectId, currentPage, selectedTool]);

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
    
    let pageId = currentPageData?._id;
    if (!pageId) {
      pageId = await ensurePage({ projectId, pageNumber: currentPage });
    }
    console.log('Clearing elements for page:', pageId);
    try {
      await clearElements({
        pageId,
        stageType: currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
      });
      console.log('Clear elements mutation completed');
    } catch (error) {
      console.error('Error clearing elements:', error);
    }
    setElements([]);
    setSelectedElementId(null);
  }, [currentPageData, pages, currentStage, clearElements, ensurePage, projectId, currentPage]);

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

  // Подтверждение калибровки
  const handleSubmitCalibration = useCallback(async (millimeters: number) => {
    if (!calibrationPixels) return;
    await updateProjectScale({
      projectId,
      knownLength: millimeters,
      pixelLength: calibrationPixels,
    });
    setIsCalibrating(false);
    setCalibrationModalOpen(false);
    setCalibrationPixels(null);
    setIsRecalibrating(false);
  }, [calibrationPixels, updateProjectScale, projectId]);

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
              pointerEvents: selectedTool === 'interact' ? 'none' : 'auto',
              zIndex: selectedTool === 'interact' ? -1 : 10,
              opacity: selectedTool === 'interact' ? 0 : 1,
              transition: 'opacity 0.2s ease-in-out',
              background: 'none',
              backgroundColor: 'transparent',
              width: '100%',
              height: '100%'
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
              calibrationMode={isCalibrating}
              stageType={currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials'}
            />
          </div>
        </div>

        {/* Правая панель - инструменты */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <DrawingTools
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            onClearAll={handleClearAll}
            onDeleteSelected={handleDeleteSelected}
            hasSelectedElement={!!selectedElementId}
            disabled={false}
            stageType={currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials' | undefined}
            calibrationMode={isCalibrating}
          />
          
          {/* Дополнительные настройки */}
          <div className="flex-1 p-4">
            <div className="space-y-4">
              {/* Длина потолков */}
              <CeilingHeightCard projectId={projectId} />

              {/* Список элементов */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Элементы чертежа</h4>
                <div className="space-y-2">
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
                        <ElementInfo element={element} projectId={projectId} />
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
      {/* Модальное окно калибровки */}
      {calibrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{isRecalibrating ? 'Перекалибровка масштаба' : 'Калибровка масштаба'}</h3>
            <p className="text-sm text-gray-600 mb-4">Введите реальную длину построенного отрезка (в миллиметрах) и высоту потолка (в миллиметрах):</p>
            <CalibrationForm
              onCancel={() => { setCalibrationModalOpen(false); setIsRecalibrating(false); /* остаёмся в калибровке при первичной */ }}
              onSubmit={async (mm: number, ceilingMm: number) => {
                await handleSubmitCalibration(mm);
                const num = Number(ceilingMm);
                if (!isNaN(num) && num > 0) {
                  await updateCeilingHeight({ projectId, ceilingHeight: num });
                }
              }}
              pixels={calibrationPixels ?? 0}
            />
          </div>
        </div>
      )}
    </div>
  );
} 

function useProjectScale(projectId: Id<'projects'>) {
  const project = useQuery(api.projects.getProject, { projectId });
  return project?.scale ? (project.scale.knownLength / project.scale.pixelLength) : null; // мм/px
}

function ElementInfo({ element, projectId }: { element: SvgElement; projectId: Id<'projects'> }) {
  const mmPerPx = useProjectScale(projectId);
  const info = useMemo(() => {
    switch (element.type) {
      case 'line': {
        const data = (element.data || {}) as any;
        let px: number | null = null;
        if (Array.isArray(data.points) && data.points.length >= 2) {
          let sum = 0;
          for (let i = 0; i < data.points.length - 1; i++) {
            const a = data.points[i];
            const b = data.points[i + 1];
            if (
              typeof a?.x === 'number' && typeof a?.y === 'number' &&
              typeof b?.x === 'number' && typeof b?.y === 'number'
            ) {
              sum += Math.hypot(b.x - a.x, b.y - a.y);
            }
          }
          px = sum;
        } else {
          const { x1, y1, x2, y2 } = data as { x1?: number; y1?: number; x2?: number; y2?: number };
          if ([x1, y1, x2, y2].some((v) => typeof v !== 'number')) return null;
          px = Math.hypot((x2 as number) - (x1 as number), (y2 as number) - (y1 as number));
        }
        const mm = mmPerPx ? (px * mmPerPx) : null;
        return { title: `Линия #${element.id.slice(-4)}`, subtitle: mm ? `${mm.toFixed(1)} мм` : `${px.toFixed(1)} px` };
      }
      case 'rectangle': {
        const { width, height } = (element.data || {}) as { width?: number; height?: number };
        if ([width, height].some((v) => typeof v !== 'number')) return null;
        const w = Math.abs(width as number);
        const h = Math.abs(height as number);
        const wStr = mmPerPx ? `${(w * (mmPerPx as number)).toFixed(1)} мм` : `${w.toFixed(1)} px`;
        const hStr = mmPerPx ? `${(h * (mmPerPx as number)).toFixed(1)} мм` : `${h.toFixed(1)} px`;
        return { title: `Прямоугольник #${element.id.slice(-4)}`, subtitle: `${wStr} × ${hStr}` };
      }
      case 'circle': {
        const { r } = (element.data || {}) as { r?: number };
        if (typeof r !== 'number') return null;
        const d = r * 2;
        const dStr = mmPerPx ? `${(d * mmPerPx).toFixed(1)} мм` : `${d.toFixed(1)} px`;
        return { title: `Окружность #${element.id.slice(-4)}`, subtitle: `Диаметр: ${dStr}` };
      }
      case 'polygon':
        return { title: `Многоугольник #${element.id.slice(-4)}`, subtitle: '' };
      case 'text':
        return { title: `Текст #${element.id.slice(-4)}`, subtitle: '' };
      default:
        return null;
    }
  }, [element, mmPerPx]);

  return (
    <div className="flex items-center space-x-2">
      <div className="w-3 h-3 rounded-full bg-green-600"></div>
      <div className="flex flex-col">
        <span className="text-sm text-gray-700">{info?.title ?? `${element.type} #${element.id.slice(-4)}`}</span>
        {info?.subtitle ? (
          <span className="text-xs text-gray-500">{info.subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

function CeilingHeightCard({ projectId }: { projectId: Id<'projects'> }) {
  const project = useQuery(api.projects.getProject, { projectId });
  const updateCeilingHeight = useMutation(api.projects.updateCeilingHeight);
  const [value, setValue] = React.useState<string>(project?.ceilingHeight ? String(project.ceilingHeight) : '');

  useEffect(() => {
    setValue(project?.ceilingHeight ? String(project.ceilingHeight) : '');
  }, [project?.ceilingHeight]);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-2">Длина потолков</h4>
      <div className="space-y-2">
        <label className="block text-sm text-gray-700">
          Высота потолка (мм)
          <input
            type="number"
            step="1"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="2700"
          />
        </label>
        <button
          onClick={async () => {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) {
              await updateCeilingHeight({ projectId, ceilingHeight: num });
            }
          }}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

function CalibrationForm({ onCancel, onSubmit, pixels }: { onCancel: () => void; onSubmit: (mm: number, ceilingMm: number) => void; pixels: number }) {
  const [value, setValue] = React.useState<string>("");
  const [ceiling, setCeiling] = React.useState<string>("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const mm = parseFloat(value);
        const ceilingMm = parseFloat(ceiling);
        if (!isNaN(mm) && mm > 0) {
          onSubmit(mm, ceilingMm);
        }
      }}
    >
      <div className="space-y-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Длина, мм"
        />
        <div className="text-xs text-gray-500">Измерено по экрану: {pixels.toFixed(2)} px</div>
        <input
          type="number"
          step="1"
          min="0"
          value={ceiling}
          onChange={(e) => setCeiling(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Высота потолка, мм"
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Отмена</button>
        <button type="submit" className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
      </div>
    </form>
  );
}