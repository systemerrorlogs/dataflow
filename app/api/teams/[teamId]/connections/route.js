// ==============================================
// /app/api/teams/[teamId]/connections/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const { teamId } = params;

    const result = await query(
      `SELECT id, name, connection_type, config, can_be_source, can_be_target, created_at
       FROM connections
       WHERE team_id = $1 AND is_active = true
       ORDER BY name`,
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
    const { name, connection_type, config, can_be_source, can_be_target } = body;

    const result = await query(
      `INSERT INTO connections (team_id, name, connection_type, config, can_be_source, can_be_target, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       RETURNING *`,
      [teamId, name, connection_type, JSON.stringify(config), can_be_source, can_be_target]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}