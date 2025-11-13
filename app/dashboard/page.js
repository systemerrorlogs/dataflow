'use client';

import dynamic from 'next/dynamic';

const DataPipelineApp = dynamic(() => import('@/components/DataPipelineApp'), {
  ssr: false,
});

export default function DashboardPage() {
  return <DataPipelineApp />;
}