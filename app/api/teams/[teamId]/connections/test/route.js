// File: /app/api/teams/[teamId]/connections/test/route.js
// This endpoint tests a connection configuration without saving it to the database

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Pool } from 'pg';

// Test connection configurations
async function testConnection(connectionType, config) {
  switch (connectionType) {
    case 'postgresql':
      return await testPostgreSQL(config);
    case 'oracle':
      return await testOracle(config);
    case 'mysql':
      return await testMySQL(config);
    case 'excel':
      return await testExcel(config);
    case 'csv':
      return await testCSV(config);
    default:
      throw new Error(`Unsupported connection type: ${connectionType}`);
  }
}

// PostgreSQL Connection Test
async function testPostgreSQL(config) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();

    return {
      success: true,
      message: 'PostgreSQL connection successful',
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        hint: error.hint,
      }
    };
  } finally {
    await pool.end();
  }
}

// Oracle Connection Test
async function testOracle(config) {
  try {
    const oracledb = require('oracledb');

    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: `${config.host}:${config.port || 1521}/${config.service_name || config.database}`,
      connectionTimeout: 5000,
    });

    const result = await connection.execute('SELECT * FROM v$version WHERE banner LIKE \'Oracle%\'');
    await connection.close();

    return {
      success: true,
      message: 'Oracle connection successful',
      version: result.rows[0]?.[0] || 'Connected',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.errorNum,
        offset: error.offset,
      }
    };
  }
}

// MySQL Connection Test
async function testMySQL(config) {
  try {
    const mysql = require('mysql2/promise');

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      connectTimeout: 5000,
    });

    const [rows] = await connection.execute('SELECT VERSION() as version');
    await connection.end();

    return {
      success: true,
      message: 'MySQL connection successful',
      version: rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
      }
    };
  }
}

// Excel File Test
async function testExcel(config) {
  try {
    const fs = require('fs');
    const XLSX = require('xlsx');

    // Check if file exists
    if (!fs.existsSync(config.filePath)) {
      return {
        success: false,
        error: `File not found: ${config.filePath}`,
      };
    }

    // Try to read the Excel file
    const workbook = XLSX.readFile(config.filePath);
    const sheetNames = workbook.SheetNames;

    return {
      success: true,
      message: 'Excel file accessible',
      sheets: sheetNames,
      sheetCount: sheetNames.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// CSV File Test
async function testCSV(config) {
  try {
    const fs = require('fs');
    const Papa = require('papaparse');

    // Check if file exists
    if (!fs.existsSync(config.filePath)) {
      return {
        success: false,
        error: `File not found: ${config.filePath}`,
      };
    }

    // Try to read the CSV file
    const fileContent = fs.readFileSync(config.filePath, 'utf8');
    const parsed = Papa.parse(fileContent, {
      header: true,
      preview: 1, // Only parse first row to test
    });

    if (parsed.errors.length > 0) {
      return {
        success: false,
        error: 'CSV parsing error',
        details: parsed.errors,
      };
    }

    return {
      success: true,
      message: 'CSV file accessible',
      columns: parsed.meta.fields,
      columnCount: parsed.meta.fields?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// POST endpoint - Test connection with configuration
export async function POST(req, { params }) {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;
    const body = await req.json();
    const { connection_type, config } = body;

    // Validate input
    if (!connection_type) {
      return NextResponse.json(
        { success: false, error: 'connection_type is required' },
        { status: 400 }
      );
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { success: false, error: 'config object is required' },
        { status: 400 }
      );
    }

    // Test the connection
    const result = await testConnection(connection_type, config);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test connection',
      },
      { status: 500 }
    );
  }
}