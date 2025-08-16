import React, { useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import StageSummary from './StageSummary';
import { useConvexAuth } from 'convex/react';
// import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'next/navigation';
import ExportExcelButton from './ExportExcelButton';

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openSidebar = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsSidebarOpen(true);
  };

  const scheduleCloseSidebar = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => setIsSidebarOpen(false), 250);
  };

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
    { id: 'baseboards', name: 'Плинтусы', description: 'Плинтусы (ломаная без замыкания)' },
    { id: 'electrical', name: 'Электрика', description: 'Светильники, бра, LED-ленты, розетки, выключатели' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Верхняя панель навигации */}
      <div className="bg-white shadow-sm border-b border-gray-200 relative z-30">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-2">
          <button
              className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={() => router.push('/projects')}
              title="Назад к проектам"
            >
              ←
            </button>
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
              aria-label="Информация по этапам"
              title="Информация по этапам"
              onMouseEnter={openSidebar}
              onMouseLeave={scheduleCloseSidebar}
            >
              i
            </button>
            
            <h1 className="text-xl font-semibold text-gray-900">Планировщик сметы</h1>
            {projectId && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">|</span>
                <span className="text-sm text-gray-600">Проект #{projectId.slice(-8)}</span>
              </div>
            )}
          </div>
          {projectId && (
            <div className="flex-shrink-0">
              <ExportExcelButton projectId={projectId as Id<'projects'>} />
            </div>
          )}
        </div>
      </div>

      {/* Левый сайдбар с этапами и сводкой */}
      <div
        className={`fixed left-0 top-0 h-screen w-1/2 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-200 z-40 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={openSidebar}
        onMouseLeave={scheduleCloseSidebar}
      >
        <div className="pt-4 pb-4 px-4">{/* отступ под верхнюю панель */}
        <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Этапы сметы</h2>
              <p className="text-sm text-gray-600">Выберите этап для просмотра</p>
            </div>
          <div className="my-3">
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    currentStage === stage.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                  }`}
                  title={stage.description}
                  onClick={() => onStageChange && onStageChange(stage.id)}
                  disabled={stage.id !== 'measurement' && !(project && project.scale)}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>
          {projectId && (
            <div className="mt-2">
              <StageSummary projectId={projectId as Id<'projects'>} currentStage={(currentStage as unknown) as 'measurement' | 'installation' | 'demolition' | 'markup' | 'baseboards' | 'electrical' | 'plumbing' | 'finishing' | 'materials'} />
            </div>
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