'use client';

// Force dynamic
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

import DataPipelineApp from '@/components/DataPipelineApp';

export default function DashboardPage() {
  return <DataPipelineApp />;
}