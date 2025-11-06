// File: /app/api/teams/[teamId]/dashboard/route.js
// Dashboard statistics endpoint

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    // Get execution statistics for the last 30 days
    const statsResult = await query(
      `SELECT
        status,
        COUNT(*) as count
       FROM task_executions
       WHERE team_id = $1
         AND started_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY status`,
      [teamId]
    );

    return NextResponse.json({
      stats: statsResult.rows
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}