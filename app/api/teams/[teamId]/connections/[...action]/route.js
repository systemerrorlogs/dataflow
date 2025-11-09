// File: app/api/teams/[teamId]/connections/[...action]/route.js
// Consolidates all connection-related routes into one file

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

// ============================================
// ROUTE HANDLER - All connection operations
// ============================================

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;

  // Parse action array: ['123', 'test'] or [] or ['test']
  const [connectionId, subAction] = action || [];

  try {
    // LIST: GET /api/teams/[teamId]/connections
    if (!connectionId) {
      const result = await query(
        'SELECT * FROM connections WHERE team_id = $1 ORDER BY created_at DESC',
        [teamId]
      );
      return NextResponse.json(result.rows);
    }

    // GET ONE: GET /api/teams/[teamId]/connections/[id]
    if (connectionId && !subAction) {
      const result = await query(
        'SELECT * FROM connections WHERE id = $1 AND team_id = $2',
        [connectionId, teamId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    }

    // TEST: GET /api/teams/[teamId]/connections/[id]/test
    if (subAction === 'test') {
      const result = await query(
        'SELECT * FROM connections WHERE id = $1 AND team_id = $2',
        [connectionId, teamId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      const connection = result.rows[0];
      const testResult = await testConnection(connection.connection_type, connection.config);

      return NextResponse.json(testResult);
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Connection GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [connectionId, subAction] = action || [];

  try {
    const body = await request.json();

    // CREATE: POST /api/teams/[teamId]/connections
    if (!connectionId) {
      const { name, connection_type, config, can_be_source, can_be_target } = body;

      const result = await query(
        `INSERT INTO connections (team_id, name, connection_type, config, can_be_source, can_be_target, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [teamId, name, connection_type, config, can_be_source, can_be_target, session.user.id]
      );

      return NextResponse.json(result.rows[0]);
    }

    // TEST CONNECTION (without saving): POST /api/teams/[teamId]/connections/test
    if (connectionId === 'test' && !subAction) {
      const { connection_type, config } = body;
      const testResult = await testConnection(connection_type, config);
      return NextResponse.json(testResult);
    }

    // TEST EXISTING: POST /api/teams/[teamId]/connections/[id]/test
    if (connectionId && subAction === 'test') {
      const result = await query(
        'SELECT * FROM connections WHERE id = $1 AND team_id = $2',
        [connectionId, teamId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      const connection = result.rows[0];
      const testResult = await testConnection(connection.connection_type, connection.config);

      return NextResponse.json(testResult);
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });

  } catch (error) {
    console.error('Connection POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [connectionId] = action || [];

  if (!connectionId) {
    return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, connection_type, config, can_be_source, can_be_target } = body;

    const result = await query(
      `UPDATE connections
       SET name = COALESCE($1, name),
           connection_type = COALESCE($2, connection_type),
           config = COALESCE($3, config),
           can_be_source = COALESCE($4, can_be_source),
           can_be_target = COALESCE($5, can_be_target),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND team_id = $7
       RETURNING *`,
      [name, connection_type, config, can_be_source, can_be_target, connectionId, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Connection PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, action } = params;
  const [connectionId] = action || [];

  if (!connectionId) {
    return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
  }

  try {
    const result = await query(
      'DELETE FROM connections WHERE id = $1 AND team_id = $2 RETURNING *',
      [connectionId, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Connection DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTION - Test Connection
// ============================================

async function testConnection(type, config) {
  // Import your existing testConnection logic here
  // This would be the same code from your current test route

  switch (type) {
    case 'postgresql':
      const { Pool } = require('pg');
      const pool = new Pool(config);
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT version()');
        client.release();
        await pool.end();
        return { success: true, message: 'PostgreSQL connection successful', version: result.rows[0].version };
      } catch (error) {
        return { success: false, error: error.message };
      }

    case 'mysql':
      const mysql = require('mysql2/promise');
      try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.execute('SELECT VERSION() as version');
        await connection.end();
        return { success: true, message: 'MySQL connection successful', version: rows[0].version };
      } catch (error) {
        return { success: false, error: error.message };
      }

    // Add other connection types...

    default:
      return { success: false, error: 'Unsupported connection type' };
  }
}