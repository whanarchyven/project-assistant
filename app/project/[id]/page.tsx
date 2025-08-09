
import { Id } from '../../../convex/_generated/dataModel';
import ProjectPageClient from './ProjectPageClient';


export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = id as Id<"projects">;
  return <ProjectPageClient projectId={projectId} />;
}