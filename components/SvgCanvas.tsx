/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useCallback } from 'react';

export interface SvgElement {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'text' | 'polygon';
  data: any;
  style: {
    stroke: string;
    strokeWidth: number;
    fill: string;
    opacity: number;
  };
  semanticType?: 'room' | 'door' | 'window';
}

interface SvgCanvasProps {
  width: number;
  height: number;
  scale: number;
  pan: { x: number; y: number };
  elements: SvgElement[];
  onElementsChange: (elements: SvgElement[]) => void;
  selectedTool: 'select' | 'interact' | 'line' | 'rectangle' | 'circle' | 'text' | 'polygon' | 'room' | 'door' | 'window' | 'area';
  isDrawing: boolean;
  onDrawingStart: () => void;
  onDrawingEnd: () => void;
  onElementSelect?: (elementId: string | null) => void;
  selectedElementId?: string | null;
  calibrationMode?: boolean;
  stageType?: 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials';
}

export default function SvgCanvas({
  width,
  height,
  scale,
  pan,
  elements,
  onElementsChange,
  selectedTool,
  isDrawing,
  onDrawingStart,
  onDrawingEnd,
  onElementSelect,
  selectedElementId: externalSelectedElementId,
  calibrationMode = false,
  stageType,
}: SvgCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<SvgElement | null>(null);
  const [internalSelectedElementId, setInternalSelectedElementId] = useState<string | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [areaStartPoint, setAreaStartPoint] = useState<{ x: number; y: number } | null>(null);
  
  // Используем внешний selectedElementId если он передан, иначе внутренний
  const selectedElementId = externalSelectedElementId !== undefined ? externalSelectedElementId : internalSelectedElementId;
  const setSelectedElementId = onElementSelect || setInternalSelectedElementId;

  // Преобразование координат мыши в координаты контента (PDF), инвертируя pan/scale
  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgPt = pt.matrixTransform(ctm.inverse());
      // Переводим в координаты контента: вычитаем pan и делим на scale
      return {
        x: (svgPt.x - pan.x) / scale,
        y: (svgPt.y - pan.y) / scale,
      };
    }
    
    return { x: 0, y: 0 };
  }, [pan, scale]);



  // Обработчики мыши
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Если выбран инструмент "взаимодействие", не обрабатываем события (пропускаем к PDF)
    if (selectedTool === 'interact') {
      return;
    }
    // В калибровке/на этапе измерений разрешаем только линию и выбор
    if ((calibrationMode || stageType === 'measurement') && !['line', 'select'].includes(selectedTool)) {
      return;
    }
    
    if (selectedTool === 'select') {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      const hit = findElementAtPoint(point);
      setSelectedElementId(hit ? hit.id : null);
      return;
    } else if (selectedTool === 'polygon' || selectedTool === 'room' || selectedTool === 'line') {
      // Режим рисования многоугольника
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      if (e.button === 0) { // Левая кнопка - добавить точку
        // Автозамыкание для area/polygon/room: клик рядом с первой точкой
        if ((selectedTool === 'polygon' || selectedTool === 'room') && polygonPoints.length >= 2) {
          const first = polygonPoints[0];
          const closeThreshold = 10 / (scale || 1);
          const dist = Math.hypot(point.x - first.x, point.y - first.y);
          if (dist <= closeThreshold) {
            finishPolygon();
            return;
          }
        }
        setPolygonPoints(prev => [...prev, point]);
      } else if (e.button === 2) { // Правая кнопка - завершить путь
        // предотвращаем контекстное меню, чтобы ПКМ корректно завершал линию/полигон
        e.preventDefault();
        finishPolygon();
      }
    } else if (selectedTool === 'area') {
      // Диагональная отрисовка прямоугольника
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      if (e.button === 0) {
        if (!areaStartPoint) {
          // Первая точка — начинаем превью прямоугольника
          const rectEl: SvgElement = {
            id: `element_${Date.now()}`,
            type: 'rectangle',
            data: { x: point.x, y: point.y, width: 0, height: 0 },
            style: {
              stroke: (stageType === 'demolition') ? '#ef4444' : '#16a34a',
              strokeWidth: 2,
              fill: (stageType === 'demolition') ? 'rgba(239,68,68,0.5)' : 'transparent',
              opacity: 1,
            },
          };
          setAreaStartPoint(point);
          setCurrentElement(rectEl);
          onDrawingStart();
        } else {
          // Вторая точка — завершаем прямоугольник
          const x = Math.min(areaStartPoint.x, point.x);
          const y = Math.min(areaStartPoint.y, point.y);
          const width = Math.abs(point.x - areaStartPoint.x);
          const height = Math.abs(point.y - areaStartPoint.y);
          const finalRect: SvgElement = {
            id: `element_${Date.now()}`,
            type: 'rectangle',
            data: { x, y, width, height },
            style: (currentElement?.style ?? {
              stroke: (stageType === 'demolition') ? '#ef4444' : '#16a34a',
              strokeWidth: 2,
              fill: (stageType === 'demolition') ? 'rgba(239,68,68,0.5)' : 'transparent',
              opacity: 1,
            }),
          };
          onElementsChange([...elements, finalRect]);
          setCurrentElement(null);
          setAreaStartPoint(null);
          onDrawingEnd();
        }
      }
    } else {
      // Режим рисования
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      startDrawing(point);
    }
  }, [selectedTool, getSvgPoint, polygonPoints, calibrationMode, stageType, areaStartPoint, currentElement, elements, onDrawingStart, onDrawingEnd, onElementsChange, scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Если выбран инструмент "взаимодействие", не обрабатываем события
    if (selectedTool === 'interact') {
      return;
    }
    
    if (selectedTool === 'area' && areaStartPoint && currentElement) {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      const x = Math.min(areaStartPoint.x, point.x);
      const y = Math.min(areaStartPoint.y, point.y);
      const width = Math.abs(point.x - areaStartPoint.x);
      const height = Math.abs(point.y - areaStartPoint.y);
      setCurrentElement({
        ...currentElement,
        data: { x, y, width, height },
      });
    } else if (isDrawing && currentElement) {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      updateDrawing(point);
    } else if (isDragging && selectedElementId) {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      moveElement(selectedElementId, point);
    }
  }, [selectedTool, isDrawing, currentElement, isDragging, selectedElementId, getSvgPoint, areaStartPoint]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Если выбран инструмент "взаимодействие", не обрабатываем события
    if (selectedTool === 'interact') {
      return;
    }
    // Для диагональной "Площади" не завершаем по mouseup — завершаем на второй клик
    if (selectedTool === 'area') {
      return;
    }
    
    if (isDrawing && currentElement) {
      e.stopPropagation();
      finishDrawing();
    }
    if (isDragging) {
      e.stopPropagation();
    }
    setIsDragging(false);
  }, [selectedTool, isDrawing, currentElement, isDragging]);

  // Функции рисования
  const startDrawing = useCallback((point: { x: number; y: number }) => {
    if (selectedTool === 'select') return;
    // На этапе калибровки разрешаем рисовать только линию
    if ((calibrationMode || stageType === 'measurement') && selectedTool !== 'line') return;
    // Для многоугольника/комнаты используем отдельный режим добавления точек
    if (selectedTool === 'polygon' || selectedTool === 'room' || selectedTool === 'line') return;
    
    const newElement: SvgElement = {
      id: `element_${Date.now()}`,
      type: (selectedTool === 'door' || selectedTool === 'window') ? 'rectangle' : (selectedTool as any),
      data: getInitialData(selectedTool, point),
      style: {
        stroke: (() => {
          if (selectedTool === 'door') return '#8b5e3c';
          if (selectedTool === 'window') return '#f59e0b';
          if (selectedTool === 'rectangle') {
            if (stageType === 'demolition') return '#ef4444';
            if (stageType === 'installation') return '#16a34a';
          }
          return '#16a34a';
        })(),
        strokeWidth: 2,
        fill: (() => {
          if (selectedTool === 'door') return '#8b5e3c';
          if (selectedTool === 'window') return '#f59e0b';
          if (selectedTool === 'rectangle') {
            if (stageType === 'demolition') return '#ef4444';
            if (stageType === 'installation') return '#16a34a';
          }
          return 'transparent';
        })(),
        opacity: 1,
      },
      semanticType: selectedTool === 'door' ? 'door' : selectedTool === 'window' ? 'window' : undefined,
    };
    
    setCurrentElement(newElement);
    onDrawingStart();
  }, [selectedTool, onDrawingStart]);

  const updateDrawing = useCallback((point: { x: number; y: number }) => {
    if (!currentElement) return;
    
    const updatedElement = {
      ...currentElement,
      data: updateElementData(currentElement, point),
    };
    
    setCurrentElement(updatedElement);
  }, [currentElement]);

  const finishDrawing = useCallback(() => {
    if (currentElement) {
      console.log('finishDrawing called with element:', currentElement);
      console.log('Current elements:', elements);
      const newElements = [...elements, currentElement];
      console.log('New elements array:', newElements);
      onElementsChange(newElements);
      setCurrentElement(null);
      onDrawingEnd();
    }
  }, [currentElement, elements, onElementsChange, onDrawingEnd]);

  const finishPolygon = useCallback(() => {
        if (selectedTool === 'line' || selectedTool === 'area') {
      if (polygonPoints.length >= 2) {
        const newElement: SvgElement = {
          id: `element_${Date.now()}`,
              type: selectedTool === 'line' ? 'line' : 'polygon',
          data: { points: polygonPoints },
          style: {
            stroke: '#16a34a',
            strokeWidth: 2,
                fill: selectedTool === 'area' ? 'rgba(16,185,129,0.25)' : 'transparent',
            opacity: 1,
          },
        };
        onElementsChange([...elements, newElement]);
        setPolygonPoints([]);
        onDrawingEnd();
      }
      return;
    }
    if (polygonPoints.length >= 3) {
      const isRoom = selectedTool === 'room';
      const newElement: SvgElement = {
        id: `element_${Date.now()}`,
        type: 'polygon',
        data: { points: polygonPoints },
        style: {
          stroke: isRoom ? '#16a34a' : '#16a34a',
          strokeWidth: 2,
          fill: isRoom ? 'rgba(16,185,129,0.25)' : 'transparent',
          opacity: 1,
        },
        semanticType: isRoom ? 'room' : undefined,
      };
      onElementsChange([...elements, newElement]);
      setPolygonPoints([]);
      onDrawingEnd();
    }
  }, [polygonPoints, elements, onElementsChange, onDrawingEnd, selectedTool]);

  // Вспомогательные функции
  const getInitialData = (type: string, point: { x: number; y: number }) => {
    switch (type) {
      case 'line':
        return { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
      case 'rectangle':
        return { x: point.x, y: point.y, width: 0, height: 0 };
      case 'door':
      case 'window':
        return { x: point.x, y: point.y, width: 0, height: 0 };
      case 'circle':
        return { cx: point.x, cy: point.y, r: 0 };
      case 'text':
        return { x: point.x, y: point.y, text: 'Текст' };
      case 'polygon':
        return { points: [{ x: point.x, y: point.y }] };
      case 'room':
        return { points: [{ x: point.x, y: point.y }] };
      default:
        return {};
    }
  };

  const updateElementData = (element: SvgElement, point: { x: number; y: number }) => {
    switch ((element.type as unknown) as 'line' | 'rectangle' | 'circle' | 'text' | 'polygon' | 'door' | 'window' | 'room') {
      case 'line':
        if (Array.isArray(element.data?.points)) {
          // Режим линии-точками: не обновляем по движению мыши
          return element.data;
        }
        return { ...element.data, x2: point.x, y2: point.y };
      case 'rectangle':
      case 'door':
      case 'window':
        return {
          ...element.data,
          width: point.x - element.data.x,
          height: point.y - element.data.y,
        };
      case 'circle':
        const dx = point.x - element.data.cx;
        const dy = point.y - element.data.cy;
        return { ...element.data, r: Math.sqrt(dx * dx + dy * dy) };
      case 'polygon':
      case 'room':
        return element.data;
      default:
        return element.data;
    }
  };

  const findElementAtPoint = (point: { x: number; y: number }) => {
    // Простая проверка попадания в элемент
    return elements.find(element => {
      switch (element.type) {
        case 'line':
          if (Array.isArray(element.data?.points) && element.data.points.length >= 2) {
            for (let i = 0; i < element.data.points.length - 1; i++) {
              const a = element.data.points[i];
              const b = element.data.points[i + 1];
              if (isPointNearLine(point, { x1: a.x, y1: a.y, x2: b.x, y2: b.y })) return true;
            }
            return false;
          }
          return isPointNearLine(point, element.data);
        case 'rectangle':
          return isPointInRectangle(point, element.data);
        case 'circle':
          return isPointInCircle(point, element.data);
        default:
          return false;
      }
    });
  };

  const moveElement = (elementId: string, point: { x: number; y: number }) => {
    const updatedElements = elements.map(element => {
      if (element.id === elementId) {
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        
        return {
          ...element,
          data: moveElementData(element, dx, dy),
        };
      }
      return element;
    });
    
    onElementsChange(updatedElements);
    setDragStart(point);
  };

  const moveElementData = (element: SvgElement, dx: number, dy: number) => {
    switch (element.type) {
      case 'line':
        if (Array.isArray(element.data?.points)) {
          return {
            ...element.data,
            points: element.data.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy })),
          };
        }
        return {
          ...element.data,
          x1: element.data.x1 + dx,
          y1: element.data.y1 + dy,
          x2: element.data.x2 + dx,
          y2: element.data.y2 + dy,
        };
      case 'rectangle':
        return {
          ...element.data,
          x: element.data.x + dx,
          y: element.data.y + dy,
        };
      case 'circle':
        return {
          ...element.data,
          cx: element.data.cx + dx,
          cy: element.data.cy + dy,
        };
      default:
        return element.data;
    }
  };

  // Функции проверки попадания
  const isPointNearLine = (point: { x: number; y: number }, lineData: any) => {
    const { x1, y1, x2, y2 } = lineData;
    const tolerance = 5;
    
    const A = point.x - x1;
    const B = point.y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= tolerance;
  };

  const isPointInRectangle = (point: { x: number; y: number }, rectData: any) => {
    const { x, y, width, height } = rectData;
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  };

  const isPointInCircle = (point: { x: number; y: number }, circleData: any) => {
    const { cx, cy, r } = circleData;
    const dx = point.x - cx;
    const dy = point.y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  // Рендер SVG элементов
  const renderElement = (element: SvgElement) => {
    const isSelected = element.id === selectedElementId;
    const style = {
      ...element.style,
      stroke: isSelected ? '#3b82f6' : element.style.stroke,
      strokeWidth: isSelected ? element.style.strokeWidth + 1 : element.style.strokeWidth,
      fill: element.style.fill === 'transparent' || element.style.fill === 'none' ? 'none' : element.style.fill,
    };

    // Толщина линии без дополнительного масштабирования (масштаб применится группой <g>)
    const adjustedStrokeWidth = style.strokeWidth;

    switch (element.type) {
      case 'line':
        if (Array.isArray(element.data?.points) && element.data.points.length >= 2) {
          const ptsStr = element.data.points.map((p: any) => `${p.x},${p.y}`).join(' ');
          return (
            <polyline
              key={element.id}
              points={ptsStr}
              stroke={style.stroke}
              strokeWidth={adjustedStrokeWidth}
              fill="none"
              opacity={style.opacity}
            />
          );
        }
        return (
          <line
            key={element.id}
            x1={element.data.x1}
            y1={element.data.y1}
            x2={element.data.x2}
            y2={element.data.y2}
            stroke={style.stroke}
            strokeWidth={adjustedStrokeWidth}
            fill={style.fill}
            opacity={style.opacity}
          />
        );
      case 'rectangle':
        return (
          <rect
            key={element.id}
            x={element.data.x}
            y={element.data.y}
            width={element.data.width}
            height={element.data.height}
            stroke={style.stroke}
            strokeWidth={adjustedStrokeWidth}
            fill={style.fill}
            opacity={style.opacity}
          />
        );
      case 'circle':
        return (
          <circle
            key={element.id}
            cx={element.data.cx}
            cy={element.data.cy}
            r={element.data.r}
            stroke={style.stroke}
            strokeWidth={adjustedStrokeWidth}
            fill={style.fill}
            opacity={style.opacity}
          />
        );
      case 'text':
        return (
          <text
            key={element.id}
            x={element.data.x}
            y={element.data.y}
            fill={style.stroke}
            fontSize={14}
            fontFamily="Arial"
          >
            {element.data.text}
          </text>
        );
      case 'polygon':
        const points = element.data.points || [];
        const pointsString = points.map((p: any) => `${p.x},${p.y}`).join(' ');
        return (
          <polygon
            key={element.id}
            points={pointsString}
            stroke={style.stroke}
            strokeWidth={adjustedStrokeWidth}
            fill={style.fill}
            opacity={style.opacity}
          />
        );
      default:
        return null;
    }
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="absolute inset-0"
      style={{
        background: 'none',
        backgroundColor: 'transparent',
        fill: 'transparent',
        pointerEvents: selectedTool === 'interact' ? 'none' : 'auto',
        width: '100%',
        height: '100%'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={(e) => {
        if (isDrawing || isDragging) {
          e.stopPropagation();
          handleMouseUp(e);
        }
      }}
      onWheel={(e) => {
        // Если выбран инструмент "взаимодействие", не обрабатываем события
        if (selectedTool === 'interact') {
          return;
        }
        // Блокируем колесико мыши для SVG Canvas
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        // если рисуем линию/многоугольник/площадь, ПКМ завершает, а не открывает меню
        if (selectedTool === 'line' || selectedTool === 'polygon' || selectedTool === 'room' || selectedTool === 'area') {
          e.preventDefault();
        }
      }}
      onDoubleClick={(e) => {
        if (selectedTool === 'polygon' || selectedTool === 'room' || selectedTool === 'line' || selectedTool === 'area') {
          e.stopPropagation();
          finishPolygon();
        }
      }}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        {/* Существующие элементы */}
        {elements.map(renderElement)}

        {/* Текущий рисуемый элемент */}
        {currentElement && renderElement(currentElement)}

        {/* Точки многоугольника в процессе рисования */}
        {(selectedTool === 'polygon' || selectedTool === 'room' || selectedTool === 'line' || selectedTool === 'area') && polygonPoints.length > 0 && (
          <>
            {/* Линии между точками */}
            {polygonPoints.length > 1 && (
              <polyline
                points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
                stroke="#3b82f6"
                strokeWidth={2}
                fill="none"
                strokeDasharray="5,5"
              />
            )}
            {/* Точки многоугольника */}
            {polygonPoints.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={4}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </>
        )}
      </g>
    </svg>
  );
} 