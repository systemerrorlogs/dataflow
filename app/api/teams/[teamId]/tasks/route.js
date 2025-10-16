// ==============================================
// /app/api/teams/[teamId]/tasks/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const { teamId } = params;

    const result = await query(
      `SELECT
         t.id, t.name, t.description, t.source_connection_id, t.target_connection_id,
         t.source_query, t.target_table, t.created_at,
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
       ORDER BY t.name`,
      [teamId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamId } = params;
    const body = await req.json();
    const { name, description, source_connection_id, target_connection_id, source_query, target_table } = body;

    const result = await query(
      `INSERT INTO tasks (team_id, name, description, source_connection_id, target_connection_id,
                          source_query, target_table, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
       RETURNING *`,
      [teamId, name, description, source_connection_id, target_connection_id, source_query, target_table]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}