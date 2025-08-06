
import { Id } from '../../../convex/_generated/dataModel';
import ProjectPageClient from './ProjectPageClient';


interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const projectId = (await params).id as Id<"projects">;
  
  return <ProjectPageClient projectId={projectId} />;
} 