// ==============================================
// /app/api/teams/[teamId]/connections/[id]/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PATCH(req, { params }) {
  try {
    const { teamId, id } = params;
    const body = await req.json();
    const { name, connection_type, config, can_be_source, can_be_target } = body;

    const result = await query(
      `UPDATE connections
       SET name = $1, connection_type = $2, config = $3, can_be_source = $4, can_be_target = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND team_id = $7
       RETURNING *`,
      [name, connection_type, JSON.stringify(config), can_be_source, can_be_target, id, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamId, id } = params;

    const result = await query(
      `UPDATE connections SET is_active = false WHERE id = $1 AND team_id = $2 RETURNING id`,
      [id, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}