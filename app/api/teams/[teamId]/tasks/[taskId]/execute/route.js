// ==============================================
// /app/api/teams/[teamId]/tasks/[taskId]/execute/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req, { params }) {
  try {
    const { teamId, taskId } = params;

    // Verify task belongs to team
    const taskCheck = await query(
      'SELECT * FROM tasks WHERE id = $1 AND team_id = $2 AND is_active = true',
      [taskId, teamId]
    );

    if (taskCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Create execution record
    const execution = await query(
      `INSERT INTO task_executions (task_id, status, triggered_by, trigger_type)
       VALUES ($1, 'pending', 1, 'manual')
       RETURNING *`,
      [taskId]
    );

    // In a real implementation, this would trigger the actual execution
    // For now, just mark it as running then success
    setTimeout(async () => {
      await query(
        `UPDATE task_executions
         SET status = 'success', completed_at = CURRENT_TIMESTAMP, records_written = 100
         WHERE id = $1`,
        [execution.rows[0].id]
      );
    }, 2000);

    return NextResponse.json(execution.rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}