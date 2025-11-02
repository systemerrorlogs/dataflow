import { NextResponse } from 'next/server';
import { query } from '@/lib/db';  // ← Update path if needed

export async function GET(request, { params }) {
  try {
    const { id: taskId } = params;  // ← Gets taskId from URL

    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    // Query using taskId
    const result = await query(
      `SELECT
        id,
        task_id,
        status,
        started_at,
        completed_at
       FROM task_executions
       WHERE task_id = $1
       ORDER BY started_at DESC`,
      [taskId]  // ← Use taskId here
    );


    // Add default values for display
    const executions = result.rows.map(row => ({
      ...row,
      records_processed: 0,
      error_message: null
    }));

    return NextResponse.json(executions);

  } catch (error) {
    console.error('Failed to fetch executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions: ' + error.message },
      { status: 500 }
    );
  }
}