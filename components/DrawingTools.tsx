import React from 'react';

export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'text' | 'polygon';

interface DrawingToolsProps {
  selectedTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
  onClearAll: () => void;
  onDeleteSelected: () => void;
  hasSelectedElement: boolean;
}

export default function DrawingTools({
  selectedTool,
  onToolSelect,
  onClearAll,
  onDeleteSelected,
  hasSelectedElement,
}: DrawingToolsProps) {
  const tools = [
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
      id: 'line' as DrawingTool,
      name: 'Линия',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M7 7h10v10" />
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
      id: 'circle' as DrawingTool,
      name: 'Окружность',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
        </svg>
      ),
    },
    {
      id: 'text' as DrawingTool,
      name: 'Текст',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      ),
    },
    {
      id: 'polygon' as DrawingTool,
      name: 'Многоугольник',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Инструменты рисования
      </h3>
      
      {/* Панель инструментов */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
              selectedTool === tool.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900'
            }`}
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
          disabled={!hasSelectedElement}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Удалить выбранный
        </button>
        
        <button
          onClick={onClearAll}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Очистить все
        </button>
      </div>

      {/* Подсказки */}
      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Подсказки:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Выберите инструмент и нарисуйте элемент</li>
          <li>• Используйте "Выбор" для перемещения элементов</li>
          <li>• Двойной клик для редактирования текста</li>
          <li>• Delete для удаления выбранного элемента</li>
          <li>• Для многоугольника: левый клик - добавить точку, правый - завершить</li>
        </ul>
      </div>
    </div>
  );
} 