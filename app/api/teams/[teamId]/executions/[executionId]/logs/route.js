import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId, executionId } = params;

    // Verify execution belongs to team
    const execCheck = await query(`
      SELECT te.id
      FROM task_executions te
      JOIN tasks t ON te.task_id = t.id
      WHERE te.id = $1 AND t.team_id = $2
    `, [executionId, teamId]);

    if (execCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Get logs
    const result = await query(`
      SELECT *
      FROM task_execution_logs
      WHERE execution_id = $1
      ORDER BY logged_at ASC
    `, [executionId]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}