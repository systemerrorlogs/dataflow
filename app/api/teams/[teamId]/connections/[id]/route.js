import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// ============================================
// PATCH - Update connection
// ============================================
export async function PATCH(req, { params }) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Proceed with update
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

// ============================================
// DELETE - Delete connection
// ============================================
export async function DELETE(req, { params }) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Proceed with deletion
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