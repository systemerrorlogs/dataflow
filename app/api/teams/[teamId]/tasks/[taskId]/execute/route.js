// File: /app/api/teams/[teamId]/tasks/[taskId]/execute/route.js
// Enhanced version with schema management and load strategies

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teamId, taskId } = params;
    const userId = session.user.id;

    console.log(`🚀 Manual execution requested for task ${taskId} by user ${userId}`);

    // Get task details including load strategy
    const taskResult = await query(`
      SELECT
        t.*,
        sc.connection_type as source_type,
        sc.config as source_config,
        tc.connection_type as target_type,
        tc.config as target_config
      FROM tasks t
      JOIN connections sc ON t.source_connection_id = sc.id
      JOIN connections tc ON t.target_connection_id = tc.id
      WHERE t.id = $1 AND t.team_id = $2
    `, [taskId, teamId]);

    if (taskResult.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskResult.rows[0];

    // Create execution record
    const executionResult = await query(`
      INSERT INTO task_executions (
        task_id,
        status,
        trigger_type,
        triggered_by,
        started_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [taskId, 'running', 'manual', userId]);

    console.log(executionResult);
    const executionId = executionResult.rows[0].id;
    console.log(executionId);

    console.log(`✅ Created execution record ${executionId}`);

    await logExecution(executionId, 'info', 'Manual execution started');

    // Start actual execution asynchronously
    executeTask(task, executionId).catch(error => {
      console.error(`❌ Task execution ${executionId} failed:`, error);
    });

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Task execution started'
    });

  } catch (error) {
    console.error('Task execute API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute task' },
      { status: 500 }
    );
  }
}

// Helper function for logging
async function logExecution(executionId, level, message, context = null) {
  try {
    await query(`
      INSERT INTO task_execution_logs (execution_id, log_level, message, context)
      VALUES ($1, $2, $3, $4)
    `, [executionId, level, message, context ? JSON.stringify(context) : null]);
  } catch (error) {
    console.error('Failed to log:', error);
  }
}

async function executeTask(task, executionId) {
  const startTime = Date.now();

  try {
    console.log(`⚙️ Executing task ${task.id}: ${task.name}`);

    // Get load strategy from transformation_config
    const loadStrategy = task.transformation_config?.load_strategy || 'append';

    await logExecution(executionId, 'info', 'Task configuration loaded', {
      source_type: task.source_type,
      target_type: task.target_type,
      load_strategy: loadStrategy,
      source_query: task.source_query?.substring(0, 100)
    });

    // Extract data from source
    const sourceData = await extractData(task, executionId);

    await logExecution(executionId, 'info', `Extracted ${sourceData.length} records from source`);
    console.log(`📊 Extracted ${sourceData.length} records`);

    if (sourceData.length === 0) {
      await logExecution(executionId, 'warning', 'No data to load');
      await query(`
        UPDATE task_executions
        SET
          status = 'success',
          completed_at = NOW(),
          records_read = 0,
          records_written = 0
        WHERE id = $1
      `, [executionId]);
      return;
    }

    // Profile the data to determine schema
    const dataSchema = profileDataSchema(sourceData);
    await logExecution(executionId, 'info', 'Data schema profiled', dataSchema);
    console.log(`📋 Schema:`, dataSchema);

    // Load data to target with strategy
    const loadResult = await loadDataWithStrategy(
      task,
      sourceData,
      dataSchema,
      loadStrategy,
      executionId
    );

    await logExecution(executionId, 'info',
      `Loaded ${loadResult.succeeded} records to target (${loadResult.failed} failed)`);
    console.log(`✅ Loaded ${loadResult.succeeded} records`);

    // Update execution as successful
    await query(`
      UPDATE task_executions
      SET
        status = 'success',
        completed_at = NOW(),
        records_read = $1,
        records_written = $2,
        records_failed = $3
      WHERE id = $4
    `, [sourceData.length, loadResult.succeeded, loadResult.failed, executionId]);

    console.log(`✅ Task execution ${executionId} completed successfully`);

  } catch (error) {
    console.error(`❌ Task execution ${executionId} failed:`, error);

    await logExecution(executionId, 'error', error.message, { stack: error.stack });

    await query(`
      UPDATE task_executions
      SET
        status = 'failed',
        completed_at = NOW(),
        error_message = $1
      WHERE id = $2
    `, [error.message, executionId]);
  }
}

// Profile data to determine column types
function profileDataSchema(data) {
  if (data.length === 0) return {};

  const schema = {};
  const sampleSize = Math.min(100, data.length); // Sample first 100 rows

  // Get all unique column names
  const allColumns = new Set();
  data.slice(0, sampleSize).forEach(row => {
    Object.keys(row).forEach(col => allColumns.add(col));
  });

  // Analyze each column
  allColumns.forEach(column => {
    const values = data.slice(0, sampleSize)
      .map(row => row[column])
      .filter(v => v !== null && v !== undefined);

    schema[column] = inferDataType(values, column);
  });

  return schema;
}

// Infer PostgreSQL data type from sample values
function inferDataType(values, columnName) {
  if (values.length === 0) {
    return { type: 'TEXT', nullable: true };
  }

  let isInteger = true;
  let isNumeric = true;
  let isBoolean = true;
  let isDate = true;
  let isTimestamp = true;
  let maxLength = 0;
  let hasNull = false;

  for (const value of values) {
    if (value === null || value === undefined) {
      hasNull = true;
      continue;
    }

    const strValue = String(value);
    maxLength = Math.max(maxLength, strValue.length);

    // Check integer
    if (isInteger && !/^-?\d+$/.test(strValue)) {
      isInteger = false;
    }

    // Check numeric (decimal)
    if (isNumeric && !/^-?\d*\.?\d+$/.test(strValue)) {
      isNumeric = false;
    }

    // Check boolean
    if (isBoolean && !['true', 'false', 't', 'f', '1', '0', 'yes', 'no'].includes(strValue.toLowerCase())) {
      isBoolean = false;
    }

    // Check date (YYYY-MM-DD)
    if (isDate && !/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      isDate = false;
    }

    // Check timestamp
    if (isTimestamp) {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        isTimestamp = false;
      }
    }
  }

  // Determine type based on analysis
  let type;
  if (isInteger) {
    type = maxLength <= 4 ? 'SMALLINT' : maxLength <= 9 ? 'INTEGER' : 'BIGINT';
  } else if (isNumeric) {
    type = 'NUMERIC';
  } else if (isBoolean) {
    type = 'BOOLEAN';
  } else if (isDate) {
    type = 'DATE';
  } else if (isTimestamp) {
    type = 'TIMESTAMP';
  } else if (maxLength <= 255) {
    type = `VARCHAR(${Math.max(255, maxLength + 50)})`; // Add buffer
  } else {
    type = 'TEXT';
  }

  return {
    type,
    nullable: hasNull || values.length < 100,
    maxLength
  };
}

// Load data with specified strategy
async function loadDataWithStrategy(task, data, dataSchema, strategy, executionId) {
  const { target_type, target_config, target_table } = task;

  if (!['postgresql', 'mysql'].includes(target_type)) {
    // Non-database targets don't need strategy
    return await loadData(task, data, executionId);
  }

  console.log(`📤 Loading with strategy: ${strategy}`);
  await logExecution(executionId, 'info', `Applying load strategy: ${strategy}`);

  const pool = createDatabasePool(target_type, target_config);

  try {
    switch (strategy) {
      case 'create_if_not_exists':
        await ensureTableExists(pool, target_type, target_table, dataSchema, executionId);
        return await insertData(pool, target_type, target_table, data, executionId);

      case 'drop_and_create':
        await dropTable(pool, target_type, target_table, executionId);
        await createTable(pool, target_type, target_table, dataSchema, executionId);
        return await insertData(pool, target_type, target_table, data, executionId);

      case 'truncate_and_load':
        await truncateTable(pool, target_type, target_table, executionId);
        return await insertData(pool, target_type, target_table, data, executionId);

      case 'auto_alter':
        await ensureTableExists(pool, target_type, target_table, dataSchema, executionId);
        await addMissingColumns(pool, target_type, target_table, dataSchema, executionId);
        return await insertData(pool, target_type, target_table, data, executionId);

      case 'append':
      default:
        return await insertData(pool, target_type, target_table, data, executionId);
    }
  } finally {
    await closeDatabasePool(pool, target_type);
  }
}

// Create database connection pool
function createDatabasePool(dbType, config) {
  if (dbType === 'postgresql') {
    const { Pool } = require('pg');
    return new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
    });
  } else if (dbType === 'mysql') {
    const mysql = require('mysql2/promise');
    return mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
    });
  }
  throw new Error(`Unsupported database type: ${dbType}`);
}

async function closeDatabasePool(pool, dbType) {
  if (dbType === 'postgresql') {
    await pool.end();
  } else if (dbType === 'mysql') {
    await pool.end();
  }
}

// Check if table exists
async function tableExists(pool, dbType, tableName) {
  if (dbType === 'postgresql') {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = $1
      )
    `, [tableName.toLowerCase()]);
    return result.rows[0].exists;
  } else if (dbType === 'mysql') {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
    `, [tableName]);
    return rows[0].count > 0;
  }
}

// Ensure table exists (create if not)
async function ensureTableExists(pool, dbType, tableName, dataSchema, executionId) {
  const exists = await tableExists(pool, dbType, tableName);

  if (!exists) {
    await logExecution(executionId, 'info', `Table ${tableName} does not exist, creating...`);
    await createTable(pool, dbType, tableName, dataSchema, executionId);
  } else {
    await logExecution(executionId, 'info', `Table ${tableName} exists`);
  }
}

// Create table
async function createTable(pool, dbType, tableName, dataSchema, executionId) {
  const columns = Object.entries(dataSchema)
    .map(([name, info]) => {
      const nullClause = info.nullable ? '' : ' NOT NULL';
      return `${quoteIdentifier(name, dbType)} ${info.type}${nullClause}`;
    })
    .join(', ');

  const ddl = `CREATE TABLE if not exists ${quoteIdentifier(tableName, dbType)} (
    ${columns}
  )`;

  console.log('📝 DDL:', ddl);
  await logExecution(executionId, 'info', `Creating table: ${tableName}`, { ddl });

  if (dbType === 'postgresql') {
    await pool.query(ddl);
  } else if (dbType === 'mysql') {
    await pool.execute(ddl.replace('SERIAL', 'INT AUTO_INCREMENT'));
  }
}

// Drop table
async function dropTable(pool, dbType, tableName, executionId) {
  await logExecution(executionId, 'info', `Dropping table: ${tableName}`);

  const ddl = `DROP TABLE IF EXISTS ${quoteIdentifier(tableName, dbType)}`;

  if (dbType === 'postgresql') {
    await pool.query(ddl);
  } else if (dbType === 'mysql') {
    await pool.execute(ddl);
  }
}

// Truncate table
async function truncateTable(pool, dbType, tableName, executionId) {
  await logExecution(executionId, 'info', `Truncating table: ${tableName}`);

  const ddl = `TRUNCATE TABLE ${quoteIdentifier(tableName, dbType)}`;

  if (dbType === 'postgresql') {
    await pool.query(ddl + ' RESTART IDENTITY');
  } else if (dbType === 'mysql') {
    await pool.execute(ddl);
  }
}

// Add missing columns
async function addMissingColumns(pool, dbType, tableName, dataSchema, executionId) {
  // Get existing columns
  let existingColumns = [];

  if (dbType === 'postgresql') {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName.toLowerCase()]);
    existingColumns = result.rows.map(r => r.column_name);
  } else if (dbType === 'mysql') {
    const [rows] = await pool.execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
    `, [tableName]);
    existingColumns = rows.map(r => r.column_name);
  }

  // Find missing columns
  const missingColumns = Object.entries(dataSchema)
    .filter(([name]) => !existingColumns.includes(name.toLowerCase()))
    .filter(([name]) => !['id', 'created_at'].includes(name.toLowerCase()));

  if (missingColumns.length === 0) {
    await logExecution(executionId, 'info', 'No new columns to add');
    return;
  }

  await logExecution(executionId, 'info', `Adding ${missingColumns.length} new columns`, {
    columns: missingColumns.map(([name]) => name)
  });

  // Add each missing column
  for (const [name, info] of missingColumns) {
    const ddl = `ALTER TABLE ${quoteIdentifier(tableName, dbType)}
                 ADD COLUMN ${quoteIdentifier(name, dbType)} ${info.type}`;

    console.log('📝 ALTER:', ddl);

    if (dbType === 'postgresql') {
      await pool.query(ddl);
    } else if (dbType === 'mysql') {
      await pool.execute(ddl);
    }
  }
}

// Insert data
async function insertData(pool, dbType, tableName, data, executionId) {
  let succeeded = 0;
  let failed = 0;

  for (const row of data) {
    try {
      const columns = Object.keys(row);
      const values = Object.values(row);

      if (dbType === 'postgresql') {
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(
          `INSERT INTO ${quoteIdentifier(tableName, dbType)}
           (${columns.map(c => quoteIdentifier(c, dbType)).join(', ')})
           VALUES (${placeholders})`,
          values
        );
      } else if (dbType === 'mysql') {
        const placeholders = values.map(() => '?').join(', ');
        await pool.execute(
          `INSERT INTO ${quoteIdentifier(tableName, dbType)}
           (${columns.map(c => quoteIdentifier(c, dbType)).join(', ')})
           VALUES (${placeholders})`,
          values
        );
      }

      succeeded++;
    } catch (error) {
      console.error('Failed to insert row:', error.message);
      failed++;

      if (failed === 1) {
        // Log first failure
        await logExecution(executionId, 'warning', `Insert error: ${error.message}`, {
          row: row
        });
      }
    }
  }

  return { succeeded, failed };
}

// Quote identifier for SQL
function quoteIdentifier(name, dbType) {
  if (dbType === 'postgresql') {
    return `"${name}"`;
  } else if (dbType === 'mysql') {
    return `\`${name}\``;
  }
  return name;
}

// Extract and load functions from previous version
async function extractData(task, executionId) {
  const { source_type, source_config, source_query, source_worksheet } = task;

  if (source_type === 'postgresql') {
    return await extractPostgreSQL(source_config, source_query);
  } else if (source_type === 'mysql') {
    return await extractMySQL(source_config, source_query);
  } else if (source_type === 'excel') {
    return await extractExcel(source_config, source_worksheet);
  } else if (source_type === 'csv') {
    return await extractCSV(source_config);
  }

  throw new Error(`Unsupported source type: ${source_type}`);
}

async function loadData(task, data, executionId) {
  const { target_type, target_config, target_table, target_worksheet } = task;

  if (target_type === 'excel') {
    return await loadExcel(target_config, target_worksheet, data);
  } else if (target_type === 'csv') {
    return await loadCSV(target_config, data);
  }

  throw new Error(`Unsupported target type: ${target_type}`);
}

async function extractPostgreSQL(config, queryText) {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
  });

  try {
    const result = await pool.query(queryText);
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function extractMySQL(config, queryText) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port || 3306,
    database: config.database,
    user: config.username,
    password: config.password,
  });

  try {
    const [rows] = await connection.execute(queryText);
    return rows;
  } finally {
    await connection.end();
  }
}

async function extractExcel(config, worksheetName) {
  const XLSX = require('xlsx');
  const fs = require('fs');
  const workbook = XLSX.readFile(config.filePath);
  const worksheet = workbook.Sheets[worksheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

async function extractCSV(config) {
  const Papa = require('papaparse');
  const fs = require('fs');
  const fileContent = fs.readFileSync(config.filePath, 'utf8');
  const parsed = Papa.parse(fileContent, { header: true });
  return parsed.data;
}

async function loadExcel(config, worksheetName, data) {
  const XLSX = require('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);
  XLSX.writeFile(workbook, config.filePath);
  return { succeeded: data.length, failed: 0 };
}

async function loadCSV(config, data) {
  const Papa = require('papaparse');
  const fs = require('fs');
  const csv = Papa.unparse(data);
  fs.writeFileSync(config.filePath, csv);
  return { succeeded: data.length, failed: 0 };
}