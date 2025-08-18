/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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
  const [resetTrigger, setResetTrigger] = useState(0);
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
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [pendingRoomElement, setPendingRoomElement] = useState<{ elementId: string; x: number; y: number } | null>(null);
  // Убраны неиспользуемые локальные состояния имени/типа комнаты (логика перенесена в RoomCreateForm)
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<{ elementId: string; snappedPoints: Array<{x:number;y:number}>; room1?: string; room2?: string } | null>(null);
  const [openingType, setOpeningType] = useState<'opening'|'door'|'window'>('opening');
  const [openingHeight, setOpeningHeight] = useState<string>('2000');
  const [openingPairMode, setOpeningPairMode] = useState<boolean>(false);
  const [isPickingPairWall, setIsPickingPairWall] = useState<boolean>(false);
  const [pickedPairSegment, setPickedPairSegment] = useState<{ a:{x:number;y:number}; b:{x:number;y:number} } | null>(null);
  
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
              stageType: (currentStage === 'baseboards' ? 'materials' : currentStage) as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
    } : "skip"
  );

  // Загружаем проект, чтобы узнать, есть ли уже калибровка
  const project = useQuery(api.projects.getProject, { projectId });

  // Мутация для сохранения калибровки
  const updateProjectScale = useMutation(api.projects.updateProjectScale);

  // Мутации для работы с SVG элементами
  const createElement = useMutation(api.svgElements.createSvgElement);
  const updateSvgElement = useMutation(api.svgElements.updateSvgElement);
  // const updateElement = useMutation(api.svgElements.updateSvgElement);
  const deleteElement = useMutation(api.svgElements.deleteSvgElement);
  const clearElements = useMutation(api.svgElements.clearSvgElements);
  const clearOpeningsByPage = useMutation(api.rooms.clearOpeningsByPage);
  const deleteRoomCascade = useMutation(api.rooms.deleteRoomCascade);
  const updateCeilingHeight = useMutation(api.projects.updateCeilingHeight);
  const createRoom = useMutation(api.rooms.createRoom);
  const createOpening = useMutation(api.rooms.createOpening);
  const roomsOnPage = useQuery(
    api.rooms.listRoomsByPage,
    currentPageData ? { pageId: currentPageData._id } : "skip"
  );

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

  // По умолчанию высота проёма = высота потолка
  useEffect(() => {
    if (openingModalOpen) {
      const h = project?.ceilingHeight;
      if (typeof h === 'number' && h > 0) {
        setOpeningHeight(String(h));
      }
    }
  }, [openingModalOpen, project?.ceilingHeight]);

  // Синхронизация элементов из базы данных
  useEffect(() => {
    if (dbElements) {
      console.log('dbElements received:', dbElements);
      const convertedElements: SvgElement[] = dbElements.map(dbEl => ({
        id: dbEl._id,
        type: dbEl.elementType,
        data: dbEl.data,
        style: dbEl.style,
        semanticType: (dbEl as any).semanticType,
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
    
    // Перекалибровка только на этапе измерений
    if (!isCalibrating && currentStage === 'measurement' && selectedTool === 'line' && newElementsToCreate.length > 0) {
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
      // Если это проём, перед сохранением скорректируем точки по ближайшей стене комнаты
      let elementToSave = element;
      let snappedInfo: { snappedPoints?: Array<{x:number;y:number}>; room1?: string; room2?: string } = {};
      if (currentStage === 'markup' && (selectedTool as any) === 'opening' && element.type === 'line') {
        snappedInfo = ((): any => {
          try {
            // Собираем геометрию комнат: по roomsOnPage (doc) ищем соответствующий svg polygon в elements
            const roomGeoms: Array<{ roomId: string; points: Array<{x:number;y:number}> }> = [];
            (roomsOnPage ?? []).forEach((r: any) => {
              const poly = elements.find(el => el.id === (r.elementId as any) && el.type === 'polygon');
              const pts = (poly?.data?.points ?? []) as Array<{x:number;y:number}>;
              if (pts.length >= 3) roomGeoms.push({ roomId: r._id as any, points: pts });
            });
            const segPts = (element.data?.points ?? []) as Array<{x:number;y:number}>;
            if (segPts.length < 2) return {};
            const [p0, p1] = segPts;
            const projectToEdge = (a: any, b: any, p: any) => {
              const ax = a.x, ay = a.y, bx = b.x, by = b.y;
              const vx = bx - ax, vy = by - ay;
              const wx = p.x - ax, wy = p.y - ay;
              const c1 = vx*wx + vy*wy;
              const c2 = vx*vx + vy*vy;
              const t = c2 > 0 ? Math.max(0, Math.min(1, c1 / c2)) : 0;
              return { x: ax + t*vx, y: ay + t*vy, t };
            };
            const dist = (a:any,b:any)=> Math.hypot(a.x-b.x,a.y-b.y);
            let best: any = null;
            const threshold = 10; // px в координатах контента
            for (const rg of roomGeoms) {
              const pts = rg.points;
              for (let i=0;i<pts.length;i++){
                const a = pts[i], b = pts[(i+1)%pts.length];
                const pr0 = projectToEdge(a,b,p0); const pr1 = projectToEdge(a,b,p1);
                const d = dist(pr0,p0) + dist(pr1,p1);
                if ((dist(pr0,p0) <= threshold) && (dist(pr1,p1) <= threshold)){
                  if (!best || d < best.d){ best = { roomId: rg.roomId, a, b, pr0, pr1, d }; }
                }
              }
            }
            if (!best) return {};
            // Ищем вторую комнату, разделяющую ту же грань (точно совпадающую по проекции)
            let second: any = null;
            for (const rg of roomGeoms) {
              if (rg.roomId === best.roomId) continue;
              const pts = rg.points;
              for (let i=0;i<pts.length;i++){
                const a = pts[i], b = pts[(i+1)%pts.length];
                const pr0b = projectToEdge(a,b,best.pr0); const pr1b = projectToEdge(a,b,best.pr1);
                const db = dist(pr0b,best.pr0) + dist(pr1b,best.pr1);
                if (db <= threshold){ second = { roomId: rg.roomId }; break; }
              }
              if (second) break;
            }
            return { snappedPoints: [best.pr0, best.pr1], room1: best.roomId, room2: second?.roomId };
          } catch(e) { return {}; }
        })();
        if (snappedInfo.snappedPoints && snappedInfo.snappedPoints.length === 2) {
          elementToSave = {
            ...element,
            data: { points: snappedInfo.snappedPoints }
          } as any;
        }
      }

      // Доп. маркировка плинтусов в данных
      if (currentStage === 'baseboards' && elementToSave.type === 'line' && Array.isArray((elementToSave as any).data?.points)) {
        elementToSave = {
          ...elementToSave,
          data: { ...(elementToSave as any).data, isBaseboard: true },
          style: { ...(elementToSave as any).style, stroke: '#a855f7', strokeWidth: 3 },
        } as any;
      }
      const createdId = await createElement({
        pageId,
        stageType: (currentStage === 'baseboards' ? 'materials' : currentStage) as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
        elementType: elementToSave.type,
        data: elementToSave.data,
        style: elementToSave.style,
        semanticType: ((elementToSave as any).semanticType) ?? ((currentStage === 'markup') ? (element.semanticType ?? ((selectedTool === 'room') ? 'room' : (selectedTool === 'door') ? 'door' : (selectedTool === 'window') ? 'window' : undefined)) : undefined),
      });

      // Если это этап разметки и мы нарисовали комнату (polygon), откроем попап для названия/типа
      if (currentStage === 'markup' && selectedTool === 'room' && element.type === 'polygon') {
        // вычислим центр полигона для подписи
        const pts = (element.data?.points ?? []) as Array<{ x: number; y: number }>;
        if (Array.isArray(pts) && pts.length > 0) {
          const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
          const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
          setPendingRoomElement({ elementId: createdId as unknown as string, x: cx, y: cy });
          setRoomModalOpen(true);
        }
      }

      // Если размечаем проём (отрезок), запрашиваем высоту и парный режим
      if (currentStage === 'markup' && (selectedTool as any) === 'opening' && element.type === 'line') {
        if (snappedInfo.snappedPoints && snappedInfo.snappedPoints.length===2) {
          setPendingOpening({ elementId: createdId as any, snappedPoints: snappedInfo.snappedPoints, room1: snappedInfo.room1, room2: snappedInfo.room2 });
          setOpeningModalOpen(true);
          // Сразу свернуть модалку при включении парного режима — реализовано кнопкой в модалке
        }
      }
    }

    console.log('Setting elements to:', newElements);
    setElements(newElements);
  }, [currentPageData, currentStage, createElement, elements, isCalibrating, ensurePage, projectId, currentPage, selectedTool, roomsOnPage]);

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
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Вы уверены, что хотите очистить слой?');
      if (!ok) return;
    }
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
          stageType: (currentStage === 'baseboards' ? 'materials' : currentStage) as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials',
        });
      // Дополнительно чистим проёмы (относятся к разметке страницы)
      await clearOpeningsByPage({ pageId });
      console.log('Clear elements mutation completed');
    } catch (error) {
      console.error('Error clearing elements:', error);
    }
    setElements([]);
    setSelectedElementId(null);
  }, [currentPageData, pages, currentStage, clearElements, ensurePage, projectId, currentPage, clearOpeningsByPage]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedElementId) return;
    const el = elements.find(e => e.id === selectedElementId);
    if (!el) return;
    // Если это комната (polygon) — удаляем связанные проёмы и запись комнаты
    if (el.type === 'polygon') {
      const room = (roomsOnPage as any[] | undefined)?.find(r => (r.elementId as any) === selectedElementId);
      if (room) {
        try { await deleteRoomCascade({ roomId: room._id as any }); } catch {}
      }
    }
    if (!selectedElementId.startsWith('element_')) {
      await deleteElement({ elementId: selectedElementId as Id<'svgElements'> });
    }
    setElements(prev => prev.filter(e => e.id !== selectedElementId));
    setSelectedElementId(null);
  }, [selectedElementId, elements, roomsOnPage, deleteRoomCascade, deleteElement]);

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
          <span className="text-sm text-gray-600 flex items-center gap-2">
            Масштаб: {Math.round(scale * 100)}%
            <button
              onClick={() => setScale(prev => Math.max(prev / 1.2, 0.1))}
              className="p-1 rounded border border-gray-200 hover:bg-gray-50"
              title="Уменьшить масштаб"
            >
              −
            </button>
            <button
              onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
              className="p-1 rounded border border-gray-200 hover:bg-gray-50"
              title="Увеличить масштаб"
            >
              +
            </button>
            <button
              onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); setResetTrigger(t => t + 1); }}
              className="p-1 rounded border border-gray-200 hover:bg-gray-50"
              title="Сброс масштаба"
            >
              ⟲
            </button>
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
              controlledScale={scale}
              resetTrigger={resetTrigger}
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
              pairPickMode={isPickingPairWall}
              onPairWallPicked={(seg)=>{
                // Определяем room2 по ближайшему ребру комнаты ко второй точке
                const pick = seg.pickPoint;
                let foundRoom2: string | undefined = undefined;
                if (roomsOnPage && elements) {
                  for (const r of roomsOnPage as any[]) {
                    const poly = elements.find(el => el.id === (r.elementId as any) && el.type === 'polygon');
                    const pts = (poly?.data?.points ?? []) as Array<{ x:number; y:number }>;
                    if (pts.length >= 3) {
                      // найдём ближайшее ребро к точке
                      let bestD = Infinity;
                      for (let i=0;i<pts.length;i++){
                        const a = pts[i], b = pts[(i+1)%pts.length];
                        const vx=b.x-a.x, vy=b.y-a.y; const wx=pick.x-a.x, wy=pick.y-a.y; const c1=vx*wx+vy*wy; const c2=vx*vx+vy*vy; const t=c2>0?Math.max(0,Math.min(1,c1/c2)):0; const pr={x:a.x+t*vx,y:a.y+t*vy};
                        const d = Math.hypot(pr.x-pick.x, pr.y-pick.y);
                        if (d < bestD) { bestD = d; }
                      }
                      if (bestD < 40) { foundRoom2 = (r._id as string); break; }
                    }
                  }
                }
                setPickedPairSegment({ a: seg.a, b: seg.b });
                setIsPickingPairWall(false);
                // вернём модалку и проставим room2 в pendingOpening
                setOpeningModalOpen(true);
                setPendingOpening(prev => prev ? { ...prev, room2: foundRoom2 } : prev);
              }}
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

      {openingModalOpen && pendingOpening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Проём</h3>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              if (!currentPageData?._id || !pendingOpening) return;
              const pts = pendingOpening.snappedPoints;
              let lengthPx=0; for(let i=0;i<pts.length-1;i++){ lengthPx += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y); }
              // Создаём opening: room1 всегда заполняем, room2 если есть (для пары)
              await createOpening({ projectId, pageId: currentPageData._id, elementId: pendingOpening.elementId as any, roomId1: (pendingOpening.room1 as any) ?? ('' as any), roomId2: (pendingOpening.room2 as any) || undefined, openingType: openingType as any, heightMm: Number(openingHeight)||0, lengthPx });
              // Обновляем цвет первой линии под выбранный тип
              try {
                const strokeColor = (openingType==='window'?'#f59e0b': openingType==='door'?'#8b5e3c':'#ef4444');
                await updateSvgElement({ elementId: pendingOpening.elementId as any, style: { stroke: strokeColor, strokeWidth: 4, fill: 'transparent', opacity: 1 } as any });
                setElements(prev => prev.map(el => el.id === pendingOpening.elementId ? ({ ...el, style: { ...el.style, stroke: strokeColor, strokeWidth: 4, fill: 'transparent', opacity: 1 } }) : el));
              } catch {}
              // Если парный — дорисуем второй сегмент на второй стене
              if (openingPairMode && pickedPairSegment) {
                const a = pickedPairSegment.a, b = pickedPairSegment.b;
                const len2 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const ux = (b.x - a.x) / len2, uy = (b.y - a.y) / len2;
                // Центр — проекция середины первого сегмента на вторую стену
                const mid = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 };
                const wx = mid.x - a.x, wy = mid.y - a.y; const tMid = Math.max(0, Math.min(len2, wx*ux + wy*uy));
                const q = { x: a.x + ux * tMid, y: a.y + uy * tMid };
                const half = (lengthPx) / 2;
                let t0 = Math.max(0, tMid - half); let t1 = Math.min(len2, tMid + half);
                if (t1 - t0 < 1e-3) { t0 = Math.max(0, tMid - 1); t1 = Math.min(len2, tMid + 1); }
                const p0 = { x: a.x + ux * t0, y: a.y + uy * t0 };
                const p1 = { x: a.x + ux * t1, y: a.y + uy * t1 };
              const pairLine = { id: `element_${Date.now()}_pair`, type: 'line' as const, data: { points: [p0, p1] }, style: { stroke: (openingType==='window'?'#f59e0b': openingType==='door'?'#8b5e3c':'#ef4444'), strokeWidth: 4, fill: 'transparent', opacity: 1 } };
                // Оптимистический рендер
                setElements(prev => [...prev, pairLine as any]);
                // Сохранение второй линии в БД и создание второго opening под вторую комнату
                 const secondElementId = await createElement({
                  pageId: currentPageData._id,
                  stageType: 'markup',
                  elementType: 'line',
                  data: pairLine.data as any,
                   style: pairLine.style as any,
                  semanticType: undefined,
                });
                if (pendingOpening.room2) {
                  await createOpening({ projectId, pageId: currentPageData._id, elementId: secondElementId as any, roomId1: pendingOpening.room2 as any, roomId2: (pendingOpening.room1 as any) || undefined, openingType: openingType as any, heightMm: Number(openingHeight)||0, lengthPx });
                }
              }
              setOpeningModalOpen(false);
              setPendingOpening(null);
              setIsPickingPairWall(false);
              setPickedPairSegment(null);
            }}>
              <div className="space-y-3">
                <label className="block text-sm text-gray-700">
                  Тип
                  <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" value={openingType} onChange={(e)=>setOpeningType(e.target.value as any)}>
                    <option value="opening">Проём</option>
                    <option value="door">Дверь</option>
                    <option value="window">Окно</option>
                  </select>
                </label>
                <label className="block text-sm text-gray-700">
                  Высота (мм)
                  <input className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" value={openingHeight} onChange={(e)=>setOpeningHeight(e.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={openingPairMode} onChange={(e)=>setOpeningPairMode(e.target.checked)} /> Парный проём
                </label>
                {openingPairMode && !isPickingPairWall && (
                  <button type="button" className="px-2 py-1 text-xs bg-gray-100 rounded border" onClick={()=> { setIsPickingPairWall(true); setOpeningModalOpen(false); }}>Указать вторую стену</button>
                )}
                {isPickingPairWall && (
                  <div className="text-xs text-blue-600">Кликните по второй стене на плане (подсвечивается пунктиром)</div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={()=>{ setOpeningModalOpen(false); setPendingOpening(null); }} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Отмена</button>
                <button type="submit" disabled={openingPairMode && !pickedPairSegment} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roomModalOpen && pendingRoomElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Новая комната</h3>
            <RoomCreateForm
              projectId={projectId}
              pageId={currentPageData?._id}
              elementId={pendingRoomElement.elementId as any}
              onCancel={() => { setRoomModalOpen(false); setPendingRoomElement(null); }}
              onSubmit={async (name: string, typeId: string) => {
                if (!currentPageData?._id) return;
                await createRoom({ projectId, pageId: currentPageData._id, elementId: pendingRoomElement.elementId as any, name, roomTypeId: typeId as any });
                // Добавим текстовую подпись в центр комнаты
                await createElement({
                  pageId: currentPageData._id,
                  stageType: 'markup',
                  elementType: 'text',
                  data: { x: pendingRoomElement.x, y: pendingRoomElement.y, text: name },
                  style: { stroke: '#111827', strokeWidth: 1, fill: 'transparent', opacity: 1 },
                  semanticType: undefined,
                });
                setRoomModalOpen(false);
                setPendingRoomElement(null);
              }}
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

function RoomCreateForm({ projectId, pageId, elementId, onCancel, onSubmit }: { projectId: Id<'projects'>; pageId?: Id<'pages'>; elementId: Id<'svgElements'>; onCancel: () => void; onSubmit: (name: string, typeId: string) => void }) {
  const types = useQuery(api.rooms.listRoomTypes) || [];
  const [name, setName] = React.useState<string>("");
  const [typeId, setTypeId] = React.useState<string>(types[0]?._id ?? "");
  React.useEffect(() => { if (!typeId && types.length > 0) setTypeId(types[0]._id as any); }, [types, typeId]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!name || !typeId) return; onSubmit(name, typeId); }}>
      <div className="space-y-3">
        <label className="block text-sm text-gray-700">
          Название комнаты
          <input className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" value={name} onChange={(e) => setName(e.target.value)} placeholder="Кухня 1" />
        </label>
        <label className="block text-sm text-gray-700">
          Тип комнаты
          <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t: any) => (
              <option key={t._id} value={t._id as string}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Отмена</button>
        <button type="submit" className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
      </div>
    </form>
  );
}