// ==============================================
// /app/api/teams/[teamId]/query/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

import { query } from '@/lib/db';
import { Pool } from 'pg';

export async function POST(req, { params }) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;
    const body = await req.json();
    const { connection_id, query_text } = body;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND team_id = $2 AND is_active = true AND can_be_source = true',
      [connection_id, teamId]
    );

    if (connResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connResult.rows[0];
    const startTime = Date.now();

    // Execute query based on connection type
    if (connection.connection_type === 'database') {
      const queryPool = new Pool({
        host: connection.config.host,
        port: connection.config.port,
        database: connection.config.database,
        user: connection.config.username,
        password: connection.config.password,
        ssl: connection.config.ssl ? { rejectUnauthorized: false } : false,
      });

      try {
        const result = await queryPool.query(query_text);
        await queryPool.end();

        const executionTime = Date.now() - startTime;
        const columns = result.fields.map(f => f.name);
        const rows = result.rows.map(row => columns.map(col => row[col]));

        // Log query execution
        await query(
          `INSERT INTO query_history (team_id, user_id, connection_id, query_text,
                                       execution_time_ms, rows_returned, was_successful)
           VALUES ($1, 1, $2, $3, $4, $5, true)`,
          [teamId, connection_id, query_text, executionTime, rows.length]
        );

        return NextResponse.json({
          success: true,
          columns,
          rows,
          rowCount: rows.length,
          executionTime
        });
      } catch (error) {
        await queryPool.end();

        // Log failed query
        await query(
          `INSERT INTO query_history (team_id, user_id, connection_id, query_text,
                                       execution_time_ms, rows_returned, was_successful, error_message)
           VALUES ($1, 1, $2, $3, $4, 0, false, $5)`,
          [teamId, connection_id, query_text, Date.now() - startTime, error.message]
        );

        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: `Query execution not yet implemented for ${connection.connection_type}`
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}