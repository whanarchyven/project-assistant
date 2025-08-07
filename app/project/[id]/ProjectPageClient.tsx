"use client";

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import ProjectLayout from '../../../components/ProjectLayout';
import DrawingCanvas from '../../../components/DrawingCanvas';

interface ProjectPageClientProps {
  projectId: Id<"projects">;
}

export default function ProjectPageClient({ projectId }: ProjectPageClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentStage, setCurrentStage] = useState('measurement');
  const [numPages, setNumPages] = useState(0);
  
  const project = useQuery(api.projects.getProject, { projectId });
  const pages = useQuery(api.projects.getProjectPages, { projectId });

  if (project === undefined || pages === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Загрузка проекта...</div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Проект не найден</div>
      </div>
    );
  }

  return (
    <ProjectLayout
      projectId={projectId}
      currentPage={currentPage}
      currentStage={currentStage}
    >
      <DrawingCanvas
        projectId={projectId}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        currentStage={currentStage}
      />
    </ProjectLayout>
  );
} 