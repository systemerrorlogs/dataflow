'use client';

// Force dynamic
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = false;

import DataPipelineApp from '@/components/DataPipelineApp';

export default function DashboardPage() {
  return <DataPipelineApp />;
}