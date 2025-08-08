import React, { useState, useRef, useEffect, useCallback } from 'react';

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
}

interface SvgCanvasProps {
  width: number;
  height: number;
  scale: number;
  pan: { x: number; y: number };
  elements: SvgElement[];
  onElementsChange: (elements: SvgElement[]) => void;
  selectedTool: 'select' | 'line' | 'rectangle' | 'circle' | 'text' | 'polygon';
  isDrawing: boolean;
  onDrawingStart: () => void;
  onDrawingEnd: () => void;
  onElementSelect?: (elementId: string | null) => void;
  selectedElementId?: string | null;
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
}: SvgCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<SvgElement | null>(null);
  const [internalSelectedElementId, setInternalSelectedElementId] = useState<string | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  
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
    // Если выбран инструмент "выбор", не обрабатываем события
    if (selectedTool === 'select') {
      return;
    }
    
    if (selectedTool === 'polygon') {
      // Режим рисования многоугольника
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      if (e.button === 0) { // Левая кнопка - добавить точку
        setPolygonPoints(prev => [...prev, point]);
      } else if (e.button === 2) { // Правая кнопка - завершить многоугольник
        if (polygonPoints.length >= 3) {
          finishPolygon();
        }
      }
    } else {
      // Режим рисования
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      startDrawing(point);
    }
  }, [selectedTool, getSvgPoint, polygonPoints]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Если выбран инструмент "выбор", не обрабатываем события
    if (selectedTool === 'select') {
      return;
    }
    
    if (isDrawing && currentElement) {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      updateDrawing(point);
    } else if (isDragging && selectedElementId) {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      moveElement(selectedElementId, point);
    }
  }, [selectedTool, isDrawing, currentElement, isDragging, selectedElementId, getSvgPoint]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Если выбран инструмент "выбор", не обрабатываем события
    if (selectedTool === 'select') {
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
    
    const newElement: SvgElement = {
      id: `element_${Date.now()}`,
      type: selectedTool as 'line' | 'rectangle' | 'circle' | 'text' | 'polygon',
      data: getInitialData(selectedTool, point),
      style: {
        stroke: '#000000',
        strokeWidth: 2,
        fill: 'transparent',
        opacity: 1,
      },
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
    if (polygonPoints.length >= 3) {
      const newElement: SvgElement = {
        id: `element_${Date.now()}`,
        type: 'polygon',
        data: { points: polygonPoints },
        style: {
          stroke: '#000000',
          strokeWidth: 2,
          fill: 'transparent',
          opacity: 1,
        },
      };
      
      onElementsChange([...elements, newElement]);
      setPolygonPoints([]);
      onDrawingEnd();
    }
  }, [polygonPoints, elements, onElementsChange, onDrawingEnd]);

  // Вспомогательные функции
  const getInitialData = (type: string, point: { x: number; y: number }) => {
    switch (type) {
      case 'line':
        return { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
      case 'rectangle':
        return { x: point.x, y: point.y, width: 0, height: 0 };
      case 'circle':
        return { cx: point.x, cy: point.y, r: 0 };
      case 'text':
        return { x: point.x, y: point.y, text: 'Текст' };
      case 'polygon':
        return { points: `${point.x},${point.y}` };
      default:
        return {};
    }
  };

  const updateElementData = (element: SvgElement, point: { x: number; y: number }) => {
    switch (element.type) {
      case 'line':
        return { ...element.data, x2: point.x, y2: point.y };
      case 'rectangle':
        return {
          ...element.data,
          width: point.x - element.data.x,
          height: point.y - element.data.y,
        };
      case 'circle':
        const dx = point.x - element.data.cx;
        const dy = point.y - element.data.cy;
        return { ...element.data, r: Math.sqrt(dx * dx + dy * dy) };
      default:
        return element.data;
    }
  };

  const findElementAtPoint = (point: { x: number; y: number }) => {
    // Простая проверка попадания в элемент
    return elements.find(element => {
      switch (element.type) {
        case 'line':
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
        pointerEvents: selectedTool === 'select' ? 'none' : 'auto',
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
        // Если выбран инструмент "выбор", не обрабатываем события
        if (selectedTool === 'select') {
          return;
        }
        // Блокируем колесико мыши для SVG Canvas
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        {/* Существующие элементы (только при рисовании) */}
        {selectedTool !== 'select' && elements.map(renderElement)}

        {/* Текущий рисуемый элемент */}
        {currentElement && renderElement(currentElement)}

        {/* Точки многоугольника в процессе рисования */}
        {selectedTool === 'polygon' && polygonPoints.length > 0 && (
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