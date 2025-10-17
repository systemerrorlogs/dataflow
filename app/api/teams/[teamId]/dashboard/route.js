// ==============================================
// /app/api/teams/[teamId]/dashboard/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

import { query } from '@/lib/db';

export async function GET(req, { params }) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;

    // Get today's execution summary
    const statsResult = await query(
      `SELECT
         status,
         COUNT(*) as count,
         SUM(records_written) as total_records
       FROM task_executions
       WHERE DATE(started_at) = CURRENT_DATE
         AND task_id IN (SELECT id FROM tasks WHERE team_id = $1)
       GROUP BY status`,
      [teamId]
    );

    return NextResponse.json({
      stats: statsResult.rows
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}