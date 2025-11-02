// File: /app/api/teams/[teamId]/tasks/[taskId]/route.js
// This handles GET (fetch single task) and PATCH (update task)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// GET - Get single task by ID
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId, taskId } = params;

    const result = await query(`
      SELECT
        id,
        name,
        description,
        source_connection_id,
        target_connection_id,
        source_query,
        source_worksheet,
        target_table,
        target_worksheet,
        transformation_config,
        created_at,
        updated_at
      FROM tasks
      WHERE id = $1 AND team_id = $2 AND is_active = true
    `, [taskId, teamId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = result.rows[0];

    // Parse transformation_config if it's stored as JSON string
    if (task.transformation_config && typeof task.transformation_config === 'string') {
      try {
        task.transformation_config = JSON.parse(task.transformation_config);
      } catch (e) {
        console.error('Failed to parse transformation_config:', e);
        task.transformation_config = {};
      }
    }

    return NextResponse.json(task);

  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update task
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId, taskId } = params;

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const {
      name,
      description,
      source_connection_id,
      target_connection_id,
      source_query,
      source_worksheet,
      target_table,
      target_worksheet,
      transformation_config
    } = body;

    // Validation
    if (!name || !source_connection_id || !target_connection_id || !source_query || !target_table) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Verify connections belong to this team
    const connCheck = await query(
      `SELECT COUNT(*) as count FROM connections
       WHERE id IN ($1, $2) AND team_id = $3 AND is_active = true`,
      [source_connection_id, target_connection_id, teamId]
    );

    if (parseInt(connCheck.rows[0].count) !== 2) {
      return NextResponse.json({ error: 'Invalid connections for this team' }, { status: 400 });
    }

    // Stringify transformation_config if it's an object
    const transformConfigJson = transformation_config
      ? (typeof transformation_config === 'string' ? transformation_config : JSON.stringify(transformation_config))
      : null;

    const result = await query(`
      UPDATE tasks
      SET
        name = $1,
        description = $2,
        source_connection_id = $3,
        target_connection_id = $4,
        source_query = $5,
        source_worksheet = $6,
        target_table = $7,
        target_worksheet = $8,
        transformation_config = $9,
        updated_at = NOW()
      WHERE id = $10 AND team_id = $11 AND is_active = true
      RETURNING *
    `, [
      name,
      description,
      source_connection_id,
      target_connection_id,
      source_query,
      source_worksheet || null,
      target_table,
      target_worksheet || null,
      transformConfigJson,
      taskId,
      teamId
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Update task error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// DELETE - Soft delete task (set is_active = false)
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId, taskId } = params;

    const result = await query(`
      UPDATE tasks
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND team_id = $2 AND is_active = true
      RETURNING id
    `, [taskId, teamId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Task deleted' });

  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}