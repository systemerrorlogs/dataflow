// ==============================================
// /app/api/teams/[teamId]/connections/[id]/test/route.js
// ==============================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Pool } from 'pg';

export async function POST(req, { params }) {
  try {
    const { teamId, id } = params;

    // Get connection details
    const result = await query(
      'SELECT * FROM connections WHERE id = $1 AND team_id = $2 AND is_active = true',
      [id, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = result.rows[0];

    // Test based on connection type
    if (connection.connection_type === 'database') {
      // Test database connection
      const testPool = new Pool({
        host: connection.config.host,
        port: connection.config.port,
        database: connection.config.database,
        user: connection.config.username,
        password: connection.config.password,
        ssl: connection.config.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });

      try {
        const testResult = await testPool.query('SELECT 1');
        await testPool.end();
        return NextResponse.json({ success: true, message: 'Connection successful' });
      } catch (error) {
        await testPool.end();
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    } else {
      // For other connection types, just return success for now
      return NextResponse.json({ success: true, message: `${connection.connection_type} connection test not yet implemented` });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}