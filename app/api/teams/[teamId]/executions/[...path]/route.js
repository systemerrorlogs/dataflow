// File: app/api/teams/[teamId]/executions/[...path]/route.js
// Consolidates execution and execution logs routes

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// ============================================
// ROUTE HANDLER - Execution operations
// ============================================

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, path } = params;
  const [executionId, subPath] = path || [];

  try {
    // GET EXECUTION: GET /api/teams/[teamId]/executions/[executionId]
    if (executionId && !subPath) {
      const result = await query(`
        SELECT te.*, t.name as task_name
        FROM task_executions te
        JOIN tasks t ON te.task_id = t.id
        WHERE te.id = $1 AND t.team_id = $2
      `, [executionId, teamId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    }

    // GET LOGS: GET /api/teams/[teamId]/executions/[executionId]/logs
    if (executionId && subPath === 'logs') {
      // Verify execution belongs to this team
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
        FROM execution_logs
        WHERE execution_id = $1
        ORDER BY logged_at ASC
      `, [executionId]);

      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Execution GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, path } = params;
  const [executionId, subPath] = path || [];

  try {
    // ADD LOG: POST /api/teams/[teamId]/executions/[executionId]/logs
    if (executionId && subPath === 'logs') {
      const body = await request.json();
      const { log_level, message, context } = body;

      // Verify execution belongs to this team
      const execCheck = await query(`
        SELECT te.id
        FROM task_executions te
        JOIN tasks t ON te.task_id = t.id
        WHERE te.id = $1 AND t.team_id = $2
      `, [executionId, teamId]);

      if (execCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
      }

      // Insert log
      const result = await query(`
        INSERT INTO execution_logs (execution_id, log_level, message, context)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [executionId, log_level, message, context]);

      return NextResponse.json(result.rows[0]);
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Execution POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, path } = params;
  const [executionId] = path || [];

  if (!executionId) {
    return NextResponse.json({ error: 'Execution ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { status, error_message, records_read, records_written } = body;

    // Verify execution belongs to this team
    const execCheck = await query(`
      SELECT te.id
      FROM task_executions te
      JOIN tasks t ON te.task_id = t.id
      WHERE te.id = $1 AND t.team_id = $2
    `, [executionId, teamId]);

    if (execCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Update execution
    const result = await query(`
      UPDATE task_executions
      SET status = COALESCE($1, status),
          error_message = COALESCE($2, error_message),
          records_read = COALESCE($3, records_read),
          records_written = COALESCE($4, records_written),
          completed_at = CASE WHEN $1 IN ('success', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = $5
      RETURNING *
    `, [status, error_message, records_read, records_written, executionId]);

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Execution PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}