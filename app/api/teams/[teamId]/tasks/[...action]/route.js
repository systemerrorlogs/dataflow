// File: app/api/teams/[teamId]/tasks/[...action]/route.js
// Consolidates all task-related routes into one file
export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// ============================================
// ROUTE HANDLER - All task operations
// ============================================

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [taskId, subAction, subId] = action || [];

  try {
    // LIST TASKS: GET /api/teams/[teamId]/tasks
    if (!taskId) {
      const result = await query(`
        SELECT t.*,
               sc.name as source_name,
               tc.name as target_name,
               (SELECT status FROM task_executions
                WHERE task_id = t.id
                ORDER BY started_at DESC LIMIT 1) as last_status,
               (SELECT started_at FROM task_executions
                WHERE task_id = t.id
                ORDER BY started_at DESC LIMIT 1) as last_run,
               (SELECT records_written FROM task_executions
                WHERE task_id = t.id AND status = 'success'
                ORDER BY started_at DESC LIMIT 1) as last_records
        FROM tasks t
        LEFT JOIN connections sc ON t.source_connection_id = sc.id
        LEFT JOIN connections tc ON t.target_connection_id = tc.id
        WHERE t.team_id = $1
        ORDER BY t.created_at DESC
      `, [teamId]);

      return NextResponse.json(result.rows);
    }

    // GET ONE TASK: GET /api/teams/[teamId]/tasks/[taskId]
    if (taskId && !subAction) {
      const result = await query(
        'SELECT * FROM tasks WHERE id = $1 AND team_id = $2',
        [taskId, teamId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    }

    // GET EXECUTIONS: GET /api/teams/[teamId]/tasks/[taskId]/executions
    if (subAction === 'executions' && !subId) {
      const result = await query(`
        SELECT * FROM task_executions
        WHERE task_id = $1
        ORDER BY started_at DESC
        LIMIT 50
      `, [taskId]);

      return NextResponse.json(result.rows);
    }

    // GET SCHEDULE HISTORY: GET /api/teams/[teamId]/tasks/[taskId]/schedule
    if (subAction === 'schedule') {
      const result = await query(`
        SELECT sl.*, u.email as changed_by_email
        FROM scheduled_tasks_log sl
        LEFT JOIN users u ON sl.changed_by = u.id
        WHERE sl.task_id = $1
        ORDER BY sl.changed_at DESC
        LIMIT 50
      `, [taskId]);

      return NextResponse.json({ history: result.rows });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [taskId, subAction] = action || [];

  try {
    const body = await request.json();

    // CREATE TASK: POST /api/teams/[teamId]/tasks
    if (!taskId) {
      const {
        name,
        description,
        source_connection_id,
        target_connection_id,
        source_query,
        source_worksheet,
        target_table,
        target_worksheet,
        loading_strategies,
        schedule_cron
      } = body;

      // Validate connections exist
      const connCheck = await query(
        'SELECT id FROM connections WHERE id IN ($1, $2) AND team_id = $3',
        [source_connection_id, target_connection_id, teamId]
      );

      if (connCheck.rows.length !== 2) {
        return NextResponse.json(
          { error: 'Invalid connection IDs' },
          { status: 400 }
        );
      }

      const result = await query(`
        INSERT INTO tasks (
          team_id, name, description,
          source_connection_id, target_connection_id,
          source_query, source_worksheet,
          target_table, target_worksheet,
          loading_strategies, schedule_cron,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        teamId, name, description,
        source_connection_id, target_connection_id,
        source_query, source_worksheet,
        target_table, target_worksheet,
        JSON.stringify(loading_strategies), schedule_cron,
        session.user.id
      ]);

      return NextResponse.json(result.rows[0]);
    }

    // EXECUTE TASK: POST /api/teams/[teamId]/tasks/[taskId]/execute
    if (taskId && subAction === 'execute') {
      // Create execution record
      const executionResult = await query(`
        INSERT INTO task_executions (task_id, status, started_at)
        VALUES ($1, 'running', CURRENT_TIMESTAMP)
        RETURNING id
      `, [taskId]);

      const executionId = executionResult.rows[0].id;

      // Get task details
      const taskResult = await query(`
        SELECT t.*,
               sc.connection_type as source_type, sc.config as source_config,
               tc.connection_type as target_type, tc.config as target_config
        FROM tasks t
        JOIN connections sc ON t.source_connection_id = sc.id
        JOIN connections tc ON t.target_connection_id = tc.id
        WHERE t.id = $1 AND t.team_id = $2
      `, [taskId, teamId]);

      if (taskResult.rows.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const task = taskResult.rows[0];

      // Execute task asynchronously (don't await)
      executeTaskAsync(executionId, task).catch(err => {
        console.error('Task execution failed:', err);
      });

      return NextResponse.json({
        success: true,
        execution_id: executionId,
        message: 'Task execution started'
      });
    }

    // UPDATE SCHEDULE: POST /api/teams/[teamId]/tasks/[taskId]/schedule
    if (taskId && subAction === 'schedule') {
      const { schedule_cron } = body;

      // Get current schedule
      const currentTask = await query(
        'SELECT schedule_cron FROM tasks WHERE id = $1 AND team_id = $2',
        [taskId, teamId]
      );

      if (currentTask.rows.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const oldSchedule = currentTask.rows[0].schedule_cron;

      // Update schedule
      const result = await query(`
        UPDATE tasks
        SET schedule_cron = $1,
            is_scheduled = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND team_id = $4
        RETURNING *
      `, [schedule_cron, !!schedule_cron, taskId, teamId]);

      // Log schedule change
      await query(`
        INSERT INTO scheduled_tasks_log (task_id, old_schedule, new_schedule, changed_by)
        VALUES ($1, $2, $3, $4)
      `, [taskId, oldSchedule, schedule_cron, session.user.id]);

      return NextResponse.json({ success: true, task: result.rows[0] });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Task POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [taskId] = action || [];

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    const result = await query(`
      UPDATE tasks
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          source_query = COALESCE($3, source_query),
          source_worksheet = COALESCE($4, source_worksheet),
          target_table = COALESCE($5, target_table),
          target_worksheet = COALESCE($6, target_worksheet),
          loading_strategies = COALESCE($7, loading_strategies),
          schedule_cron = COALESCE($8, schedule_cron),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND team_id = $10
      RETURNING *
    `, [
      body.name,
      body.description,
      body.source_query,
      body.source_worksheet,
      body.target_table,
      body.target_worksheet,
      body.loading_strategies ? JSON.stringify(body.loading_strategies) : null,
      body.schedule_cron,
      taskId,
      teamId
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Task PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [taskId] = action || [];

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }

  try {
    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND team_id = $2 RETURNING *',
      [taskId, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Task DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER - Execute Task Asynchronously
// ============================================

async function executeTaskAsync(executionId, task) {
  try {
    // Your existing task execution logic here
    // Extract data, transform, load, etc.

    // Update execution status
    await query(`
      UPDATE task_executions
      SET status = 'success',
          completed_at = CURRENT_TIMESTAMP,
          records_written = $1
      WHERE id = $2
    `, [recordCount, executionId]);

  } catch (error) {
    await query(`
      UPDATE task_executions
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error_message = $1
      WHERE id = $2
    `, [error.message, executionId]);
  }
}