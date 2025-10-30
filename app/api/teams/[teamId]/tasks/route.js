// /app/api/teams/[teamId]/tasks/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// GET - List all tasks
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;

    const result = await query(`
      SELECT 
        t.id, t.name, t.description, t.source_connection_id, t.target_connection_id,
        t.source_query, t.source_worksheet, t.target_table, t.target_worksheet,
        t.transformation_config, t.created_at, t.updated_at,
        sc.name as source_name, sc.connection_type as source_type,
        tc.name as target_name, tc.connection_type as target_type,
        te.status as last_status, te.completed_at as last_run, 
        te.records_written as last_records
      FROM tasks t
      LEFT JOIN connections sc ON t.source_connection_id = sc.id
      LEFT JOIN connections tc ON t.target_connection_id = tc.id
      LEFT JOIN LATERAL (
        SELECT status, completed_at, records_written
        FROM task_executions
        WHERE task_id = t.id
        ORDER BY started_at DESC
        LIMIT 1
      ) te ON true
      WHERE t.team_id = $1 AND t.is_active = true
      ORDER BY t.name
    `, [teamId]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('List tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new task
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;
    
    // Parse request body with error handling
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
        error: 'Missing required fields: name, source_connection_id, target_connection_id, source_query, target_table' 
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

    console.log('Creating task with:', {
      teamId,
      name,
      source_connection_id,
      target_connection_id,
      source_query: source_query.substring(0, 50) + '...',
      target_table,
      transformation_config: transformConfigJson
    });

    const result = await query(
      `INSERT INTO tasks (
        team_id, name, description, source_connection_id, target_connection_id, 
        source_query, source_worksheet, target_table, target_worksheet, 
        transformation_config, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        teamId, 
        name, 
        description, 
        source_connection_id, 
        target_connection_id, 
        source_query,
        source_worksheet || null,
        target_table,
        target_worksheet || null,
        transformConfigJson,
        session.user.id
      ]
    );

    console.log('Task created successfully:', result.rows[0].id);

    return NextResponse.json(result.rows[0], { status: 201 });
    
  } catch (error) {
    console.error('Create task error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Failed to create task',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
