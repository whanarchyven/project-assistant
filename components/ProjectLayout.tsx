import React from 'react';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'next/navigation';

interface ProjectLayoutProps {
  children: React.ReactNode;
  projectId?: string;
  currentPage?: number;
  currentStage?: string;
}

export default function ProjectLayout({ 
  children, 
  projectId, 
  currentPage = 1, 
  currentStage = 'measurement' 
}: ProjectLayoutProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Планировщик сметы
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Войдите в систему для работы с проектами
            </p>
          </div>
          <div className="mt-8 space-y-6">
            <button 
              onClick={() => router.push('/signin')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Войти в систему
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stages = [
    { id: 'measurement', name: 'Обмер', description: 'Измерение стен и площадей' },
    { id: 'installation', name: 'Монтаж', description: 'Монтажные работы' },
    { id: 'demolition', name: 'Демонтаж', description: 'Демонтажные работы' },
    { id: 'electrical', name: 'Электрика', description: 'Электромонтажные работы' },
    { id: 'plumbing', name: 'Сантехника', description: 'Сантехнические работы' },
    { id: 'finishing', name: 'Отделка', description: 'Отделочные работы' },
    { id: 'materials', name: 'Материалы', description: 'Расчет материалов' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Верхняя панель навигации */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Планировщик сметы
            </h1>
            {projectId && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">|</span>
                <span className="text-sm text-gray-600">Проект #{projectId.slice(-8)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Настройки
            </button>
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Помощь
            </button>
          </div>
        </div>
      </div>

      {/* Панель этапов */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-2">
          <div className="flex space-x-1 overflow-x-auto">
            {stages.map((stage) => (
              <button
                key={stage.id}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentStage === stage.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={stage.description}
              >
                {stage.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden">
        {/* Левая панель - PDF просмотрщик */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

        {/* Правая панель - настройки и инструменты */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Инструменты
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {stages.find(s => s.id === currentStage)?.description}
            </p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Здесь будут инструменты для текущего этапа */}
            <div className="space-y-4">
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

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Высота потолков</h4>
                <label className="block text-sm text-gray-700">
                  Высота (м)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="2.70"
                  />
                </label>
              </div>

              {currentStage === 'measurement' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Инструменты обмера</h4>
                  <div className="space-y-2">
                    <button className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                      Измерить стену
                    </button>
                    <button className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                      Измерить площадь
                    </button>
                    <button className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                      Измерить периметр
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 