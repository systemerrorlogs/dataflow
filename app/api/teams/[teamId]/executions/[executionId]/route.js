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

    const result = await query(`
      SELECT te.*
      FROM task_executions te
      JOIN tasks t ON te.task_id = t.id
      WHERE te.id = $1 AND t.team_id = $2
    `, [executionId, teamId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Get execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}