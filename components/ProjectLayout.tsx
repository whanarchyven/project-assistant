import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import StageSummary from './StageSummary';
import { useConvexAuth } from 'convex/react';
// import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'next/navigation';

interface ProjectLayoutProps {
  children: React.ReactNode;
  projectId?: Id<'projects'> | string;
  currentPage?: number;
  currentStage?: string;
  onStageChange?: (stage: string) => void;
}

export default function ProjectLayout({ 
  children, 
  projectId, 
  currentStage = 'measurement',
  onStageChange,
}: ProjectLayoutProps) {
  const { isAuthenticated } = useConvexAuth();
  // const { signOut } = useAuthActions();
  const router = useRouter();
  // Вызов хука всегда на одном уровне; если projectId нет, запрос просто не выполнится
  const project = useQuery(api.projects.getProject, { projectId: (projectId as Id<'projects'>) || ('' as unknown as Id<'projects'>) });


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
    { id: 'measurement', name: 'Калибровка', description: 'Калибровка масштаба по известной длине' },
    { id: 'demolition', name: 'Демонтаж', description: 'Демонтажные работы' },
    { id: 'installation', name: 'Монтаж', description: 'Монтаж стен' },
    { id: 'markup', name: 'Разметка', description: 'Комнаты, окна и двери' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
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
                onClick={() => onStageChange && onStageChange(stage.id)}
                disabled={stage.id !== 'measurement' && !(project && project.scale)}
              >
                {stage.name}
              </button>
            ))}
          </div>
          {projectId && (
            <StageSummary projectId={projectId as Id<'projects'>} currentStage={currentStage as 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials'} />
          )}
        </div>
      </div>

      {/* Основной контент (прокручиваемый) */}
      <div className="flex-1 flex overflow-visible">
        {/* Левая панель - PDF просмотрщик */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
} 