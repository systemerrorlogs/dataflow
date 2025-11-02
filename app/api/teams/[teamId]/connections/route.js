import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { isConnectorEnabled } from '@/lib/config/connectors';

// ============================================
// GET - List all connections
// ============================================
export async function GET(req, { params }) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Now we know user is logged in, proceed
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

// ============================================
// POST - Create new connection
// ============================================
export async function POST(request, { params }) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get the logged-in user's ID
    const userId = session.user.id;

    // 3. Parse request body ONCE
    const body = await request.json();
    const { name, connection_type, config, can_be_source, can_be_target } = body;

    // 4. Validate connector is enabled
    if (!isConnectorEnabled(connection_type)) {
      return NextResponse.json(
        { error: `Connector type '${connection_type}' is currently disabled` },
        { status: 403 }
      );
    }

    // 5. Get teamId and create connection
    const { teamId } = params;

    const result = await query(
      `INSERT INTO connections (team_id, name, connection_type, config, can_be_source, can_be_target, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [teamId, name, connection_type, JSON.stringify(config), can_be_source, can_be_target, userId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Connection creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}