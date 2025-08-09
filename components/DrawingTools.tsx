import React from 'react';

export type DrawingTool = 'select' | 'interact' | 'line' | 'rectangle' | 'circle' | 'text' | 'polygon' | 'room' | 'door' | 'window';

interface DrawingToolsProps {
  selectedTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
  onClearAll: () => void;
  onDeleteSelected: () => void;
  hasSelectedElement: boolean;
  disabled?: boolean;
  stageType?: 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials';
  calibrationMode?: boolean;
}

export default function DrawingTools({
  selectedTool,
  onToolSelect,
  onClearAll,
  onDeleteSelected,
  hasSelectedElement,
  disabled = false,
  stageType,
  calibrationMode = false,
}: DrawingToolsProps) {
  // Набор инструментов по этапам
  const baseTools = [
    {
      id: 'interact' as DrawingTool,
      name: 'Взаимодействие',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V5a1 1 0 112 0v6m-2 0l-2.5-2.5a1 1 0 111.414-1.414L14 9.586l2.086-2.086a1 1 0 111.414 1.414L15 11m-3 0l-2.5 2.5a1 1 0 001.414 1.414L14 12.414l2.086 2.086a1 1 0 001.414-1.414L15 11" />
        </svg>
      ),
    },
    {
      id: 'line' as DrawingTool,
      name: 'Линия',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5" />
        </svg>
      ),
    },
    {
      id: 'select' as DrawingTool,
      name: 'Выбор',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
        </svg>
      ),
    },
    {
      id: 'rectangle' as DrawingTool,
      name: 'Прямоугольник',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
        </svg>
      ),
    },
    {
      id: 'room' as DrawingTool,
      name: 'Комната',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="5,3 19,3 21,8 21,21 3,21 3,5" className="stroke-emerald-600" />
        </svg>
      ),
    },
    {
      id: 'window' as DrawingTool,
      name: 'Окно',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="4" y="4" width="16" height="16" className="stroke-yellow-500" />
        </svg>
      ),
    },
    {
      id: 'door' as DrawingTool,
      name: 'Дверь',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="5" y="3" width="14" height="18" className="stroke-amber-800" />
        </svg>
      ),
    },
  ];

  const restrictedStageTools: Array<{ id: DrawingTool; name: string; icon: React.JSX.Element }> = baseTools.filter(t => ['interact','select','rectangle'].includes(t.id)) as Array<{ id: DrawingTool; name: string; icon: React.JSX.Element }>;
  const markupTools: Array<{ id: DrawingTool; name: string; icon: React.JSX.Element }> = baseTools.filter(t => ['interact','select','room','window','door'].includes(t.id)) as Array<{ id: DrawingTool; name: string; icon: React.JSX.Element }>;
  let tools = baseTools;
  if (stageType === 'demolition' || stageType === 'installation') tools = restrictedStageTools;
  if ((stageType as unknown) === 'markup') tools = markupTools;
  if (calibrationMode) {
    tools = baseTools.filter(t => ['interact', 'line'].includes(t.id));
  }

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Инструменты рисования
      </h3>
      
      {/* Панель инструментов */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            disabled={disabled}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
              selectedTool === tool.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={tool.name}
          >
            {tool.icon}
            <span className="text-xs mt-1">{tool.name}</span>
          </button>
        ))}
      </div>

      {/* Кнопки действий */}
      <div className="space-y-2">
        <button
          onClick={onDeleteSelected}
          disabled={!hasSelectedElement || disabled}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Удалить выбранный
        </button>
        
        <button
          onClick={onClearAll}
          disabled={disabled}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Очистить все
        </button>
      </div>
    </div>
  );
} 