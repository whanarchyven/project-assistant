"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';
import MaterialsPageClient from './pageClient';

export default function MaterialsPage() {
  const params = useParams();
  const projectId = params?.id as Id<'projects'>;
  return <MaterialsPageClient projectId={projectId} />;
}

