import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { executionId } = params;

    // Get execution status
    const executionResult = await query(
      'SELECT status FROM task_executions WHERE id = $1',
      [executionId]
    );

    if (executionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const status = executionResult.rows[0].status;

    // Get logs for this execution
    const logsResult = await query(
      `SELECT id, log_level, message, created_at
       FROM task_execution_logs
       WHERE execution_id = $1
       ORDER BY created_at ASC`,
      [executionId]
    );

    return NextResponse.json({
      status,
      logs: logsResult.rows
    });

  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs: ' + error.message },
      { status: 500 }
    );
  }
}
