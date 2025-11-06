// =================================================
// 4. API ROUTE FOR SCHEDULE MANAGEMENT
// =================================================
// File: /app/api/teams/[teamId]/tasks/[taskId]/schedule/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { isValidCron } from '@/lib/cronHelper';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, taskId } = params;
    const { schedule_cron } = await request.json();

    // Validate cron expression
    if (schedule_cron && !isValidCron(schedule_cron)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      );
    }

    // Get current schedule for logging
    const currentTask = await query(
      'SELECT schedule_cron FROM tasks WHERE id = $1 AND team_id = $2',
      [taskId, teamId]
    );

    if (currentTask.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const oldSchedule = currentTask.rows[0].schedule_cron;

    // Update task schedule
    const result = await query(
      `UPDATE tasks
       SET schedule_cron = $1,
           is_scheduled = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND team_id = $4
       RETURNING *`,
      [schedule_cron, !!schedule_cron, taskId, teamId]
    );

    // Log the schedule change
    await query(
      `INSERT INTO scheduled_tasks_log (task_id, old_schedule, new_schedule, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [taskId, oldSchedule, schedule_cron, session.user.id]
    );

    return NextResponse.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Schedule update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Get schedule history
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;

    const result = await query(
      `SELECT sl.*, u.email as changed_by_email
       FROM scheduled_tasks_log sl
       LEFT JOIN users u ON sl.changed_by = u.id
       WHERE sl.task_id = $1
       ORDER BY sl.changed_at DESC
       LIMIT 50`,
      [taskId]
    );

    return NextResponse.json({
      history: result.rows
    });

  } catch (error) {
    console.error('Schedule history error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}