// File: /app/api/teams/[teamId]/query/route.js
// Execute queries against data sources for the Data Explorer

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query as dbQuery } from '@/lib/db';
import { Pool } from 'pg';

// Execute query based on connection type
async function executeQuery(connection, queryText, worksheetName) {
  const { connection_type, config } = connection;

  switch (connection_type) {
    case 'postgresql':
      return await executePostgreSQLQuery(config, queryText);
    case 'oracle':
      return await executeOracleQuery(config, queryText);
    case 'mysql':
      return await executeMySQLQuery(config, queryText);
    case 'sqlserver':
      return await executeSQLServerQuery(config, queryText);
    case 'vertica':
      return await executeVerticaQuery(config, queryText);
    case 'cockroachdb':
      return await executeCockroachDBQuery(config, queryText);
    case 'salesforce':
      return await executeSalesforceQuery(config, queryText);
    case 'servicenow':
      return await executeServiceNowQuery(config, queryText);
    case 'excel':
      return await executeExcelQuery(config, worksheetName);
    case 'csv':
      return await executeCSVQuery(config);
    default:
      throw new Error(`Query execution not supported for connection type: ${connection_type}`);
  }
}

// PostgreSQL query execution
async function executePostgreSQLQuery(config, queryText) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 10000,
  });

  try {
    const startTime = Date.now();
    const result = await pool.query(queryText);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      columns: result.fields.map(f => f.name),
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        position: error.position,
        hint: error.hint,
      }
    };
  } finally {
    await pool.end();
  }
}

// Oracle query execution
async function executeOracleQuery(config, queryText) {
  try {
    const oracledb = require('oracledb');

    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: `${config.host}:${config.port || 1521}/${config.service_name || config.database}`,
    });

    const startTime = Date.now();
    const result = await connection.execute(queryText, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows: 1000,
    });
    const executionTime = Date.now() - startTime;

    await connection.close();

    return {
      success: true,
      columns: result.metaData.map(m => m.name),
      rows: result.rows,
      rowCount: result.rows.length,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        errorNum: error.errorNum,
        offset: error.offset,
      }
    };
  }
}

// MySQL query execution
async function executeMySQLQuery(config, queryText) {
  try {
    const mysql = require('mysql2/promise');

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
    });

    const startTime = Date.now();
    const [rows, fields] = await connection.execute(queryText);
    const executionTime = Date.now() - startTime;

    await connection.end();

    return {
      success: true,
      columns: fields.map(f => f.name),
      rows: rows,
      rowCount: rows.length,
      executionTime,
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

// SQL Server query execution
async function executeSQLServerQuery(config, queryText) {
  try {
    const sql = require('mssql');

    const sqlConfig = {
      user: config.username,
      password: config.password,
      server: config.host,
      port: config.port || 1433,
      database: config.database,
      options: {
        encrypt: config.encrypt !== false,
        trustServerCertificate: config.trustServerCertificate !== false,
      },
    };

    const startTime = Date.now();
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query(queryText);
    const executionTime = Date.now() - startTime;

    await pool.close();

    return {
      success: true,
      columns: result.recordset.columns ? Object.keys(result.recordset.columns) : [],
      rows: result.recordset,
      rowCount: result.recordset.length,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        number: error.number,
        state: error.state,
        class: error.class,
      }
    };
  }
}

// Vertica query execution
async function executeVerticaQuery(config, queryText) {
  try {
    const vertica = require('vertica');

    const connection = vertica.connect({
      host: config.host,
      port: config.port || 5433,
      database: config.database,
      user: config.username,
      password: config.password,
    });

    const startTime = Date.now();
    const result = await new Promise((resolve, reject) => {
      connection.query(queryText, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const executionTime = Date.now() - startTime;

    connection.disconnect();

    return {
      success: true,
      columns: result.length > 0 ? Object.keys(result[0]) : [],
      rows: result,
      rowCount: result.length,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// CockroachDB query execution (uses PostgreSQL driver)
async function executeCockroachDBQuery(config, queryText) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 26257,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    const startTime = Date.now();
    const result = await pool.query(queryText);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      columns: result.fields.map(f => f.name),
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        position: error.position,
        hint: error.hint,
      }
    };
  } finally {
    await pool.end();
  }
}

// Salesforce query execution
async function executeSalesforceQuery(config, queryText) {
  try {
    const jsforce = require('jsforce');

    const conn = new jsforce.Connection({
      loginUrl: config.loginUrl || 'https://login.salesforce.com',
    });

    await conn.login(config.username, config.password);

    const startTime = Date.now();
    const result = await conn.query(queryText);
    const executionTime = Date.now() - startTime;

    // Extract column names from first record
    const columns = result.records.length > 0 ? Object.keys(result.records[0]).filter(k => k !== 'attributes') : [];

    // Clean up records (remove attributes property)
    const cleanRecords = result.records.map(record => {
      const { attributes, ...cleanRecord } = record;
      return cleanRecord;
    });

    return {
      success: true,
      columns: columns,
      rows: cleanRecords,
      rowCount: result.totalSize,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        errorCode: error.errorCode,
        name: error.name,
      }
    };
  }
}

// ServiceNow query execution
async function executeServiceNowQuery(config, queryText) {
  try {
    const axios = require('axios');

    // Parse the query to extract table name and query parameters
    // Expected format: "table:incident" or "table:incident?sysparm_query=active=true"
    const match = queryText.match(/table:(\w+)(\?.*)?/);

    if (!match) {
      return {
        success: false,
        error: 'Invalid ServiceNow query format. Use: table:tablename or table:tablename?sysparm_query=...',
      };
    }

    const tableName = match[1];
    const queryParams = match[2] || '';

    const url = `https://${config.instance}.service-now.com/api/now/table/${tableName}${queryParams}`;

    const startTime = Date.now();
    const response = await axios.get(url, {
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Accept': 'application/json',
      },
    });
    const executionTime = Date.now() - startTime;

    const records = response.data.result || [];
    const columns = records.length > 0 ? Object.keys(records[0]) : [];

    return {
      success: true,
      columns: columns,
      rows: records,
      rowCount: records.length,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
      }
    };
  }
}

// CSV query execution (read file)
async function executeCSVQuery(config) {
  try {
    const fs = require('fs');
    const Papa = require('papaparse');

    if (!fs.existsSync(config.filePath)) {
      return {
        success: false,
        error: `File not found: ${config.filePath}`,
      };
    }

    const startTime = Date.now();
    const fileContent = fs.readFileSync(config.filePath, 'utf8');
    const parsed = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    const executionTime = Date.now() - startTime;

    if (parsed.errors.length > 0) {
      return {
        success: false,
        error: 'CSV parsing error',
        details: parsed.errors,
      };
    }

    return {
      success: true,
      columns: parsed.meta.fields,
      rows: parsed.data,
      rowCount: parsed.data.length,
      executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// POST endpoint - Execute query
export async function POST(req, { params }) {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId } = params;
    const body = await req.json();
    const { connection_id, query_text, worksheet_name } = body;

    // Validate input
    if (!connection_id) {
      return NextResponse.json(
        { success: false, error: 'connection_id is required' },
        { status: 400 }
      );
    }

    // Get connection details
    const connectionResult = await dbQuery(
      'SELECT * FROM connections WHERE id = $1 AND team_id = $2',
      [connection_id, teamId]
    );

    if (connectionResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    const connection = connectionResult.rows[0];

    // For database connections, query_text is required
    if (['postgresql', 'oracle', 'mysql', 'sqlserver', 'vertica', 'cockroachdb', 'salesforce', 'servicenow'].includes(connection.connection_type) && !query_text) {
      return NextResponse.json(
        { success: false, error: 'query_text is required for this connection type' },
        { status: 400 }
      );
    }

    // For Excel connections, worksheet_name is required
    if (connection.connection_type === 'excel' && !worksheet_name) {
      return NextResponse.json(
        { success: false, error: 'worksheet_name is required for Excel connections' },
        { status: 400 }
      );
    }

    // Execute the query
    const result = await executeQuery(connection, query_text, worksheet_name);

    // Log query execution (optional - for audit/history)
    try {
      await dbQuery(
        `INSERT INTO query_history (team_id, user_id, connection_id, query_text, execution_time_ms, rows_returned, was_successful, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          teamId,
          session.user.id,
          connection_id,
          query_text || worksheet_name,
          result.executionTime,
          result.rowCount || 0,
          result.success,
          result.error || null
        ]
      );
    } catch (logError) {
      console.error('Failed to log query history:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Query execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute query',
      },
      { status: 500 }
    );
  }
}