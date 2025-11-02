// File: app/api/teams/[teamId]/tasks/[taskId]/execute/route.js

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { StrategyExecutor } from '@/lib/connectors/strategy-executor';
import { Pool } from 'pg';
const mysql = require('mysql2/promise');
const sqlserver = require('@/lib/connectors/sqlserver');
const vertica = require('@/lib/connectors/vertica');
const cockroachdb = require('@/lib/connectors/cockroachdb');
const salesforce = require('@/lib/connectors/salesforce');
const servicenow = require('@/lib/connectors/servicenow');
import { isConnectorEnabled } from '@/lib/config/connectors';

export async function POST(request, { params }) {
  try {
    const { teamId, taskId } = params;

    // 1. Create execution record
    const executionResult = await query(
      `INSERT INTO task_executions (task_id, status, started_at) 
       VALUES ($1, $2, NOW()) 
       RETURNING id`,
      [taskId, 'running']
    );
    
    const executionId = executionResult.rows[0].id;

    // 2. Start async task execution
    executeTaskAsync(taskId, executionId, teamId).catch(err => {
      console.error('Task execution error:', err);
    });
    
    // 3. Return execution_id immediately
    return NextResponse.json({ 
      success: true,
      execution_id: executionId
    });
    
  } catch (error) {
    console.error('Execute endpoint error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to write logs
async function writeLog(executionId, level, message, context = null) {
  try {
    await query(
      `INSERT INTO task_execution_logs (execution_id, log_level, message, context, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [executionId, level, message, context ? JSON.stringify(context) : null]
    );
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// Background task execution function
async function executeTaskAsync(taskId, executionId, teamId) {
  try {
    // Get task details with connections
    await writeLog(executionId, 'info', 'Loading task configuration...');
    
    const taskResult = await query(
      `SELECT t.*, 
              sc.connection_type as source_type, 
              sc.config as source_config,
              sc.name as source_name,
              tc.connection_type as target_type, 
              tc.config as target_config,
              tc.name as target_name
       FROM tasks t
       JOIN connections sc ON t.source_connection_id = sc.id
       JOIN connections tc ON t.target_connection_id = tc.id
       WHERE t.id = $1 AND t.team_id = $2`,
      [taskId, teamId]
    );

    if (taskResult.rows.length === 0) {
      throw new Error('Task not found');
    }

    const task = taskResult.rows[0];
    if (!isConnectorEnabled(task.source_type)) {
      throw new Error(`Source connector '${task.source_type}' is currently disabled`);
    }

    if (!isConnectorEnabled(task.target_type)) {
      throw new Error(`Target connector '${task.target_type}' is currently disabled`);
    }
    await writeLog(executionId, 'info', `Task: ${task.name}`);
    await writeLog(executionId, 'info', `Source: ${task.source_name} (${task.source_type})`);
    await writeLog(executionId, 'info', `Target: ${task.target_name} (${task.target_type})`);
    
    // Parse loading strategies (default if not set)
    const strategies = task.loading_strategies 
      ? (typeof task.loading_strategies === 'string' 
          ? JSON.parse(task.loading_strategies)
          : task.loading_strategies)
      : ['check_exists', 'create_table', 'append_data'];

    await writeLog(
      executionId, 
      'info', 
      `Loading strategy pipeline: ${strategies.join(' → ')}`
    );

    // Step 1: Extract data from source
    await writeLog(executionId, 'info', 'Extracting data from source...');
    const startExtract = Date.now();
    const sourceData = await extractData(task);
    const extractDuration = Date.now() - startExtract;
    
    await writeLog(
      executionId, 
      'info', 
      `Extracted ${sourceData.length} rows in ${extractDuration}ms`
    );

    if (sourceData.length === 0) {
      await writeLog(executionId, 'warning', 'No data extracted from source');
    }

    // Step 2: Execute loading strategy pipeline
    await writeLog(executionId, 'info', 'Executing loading strategies...');
    
    // Get target database connection
    const targetConn = await getConnection(task.target_type, task.target_config);
    
    try {
      const executor = new StrategyExecutor(
        sourceData,
        targetConn,
        task.target_table,
        task.target_type
      );

      const results = await executor.execute(strategies);

      // Log each strategy result
      for (const result of results) {
        if (result.success) {
          const details = Object.entries(result)
            .filter(([key]) => key !== 'strategy' && key !== 'success')
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(', ');
          
          await writeLog(
            executionId, 
            'info', 
            `Strategy '${result.strategy}' completed${details ? ': ' + details : ''}`
          );
        }
      }

      // Get final result (usually from append_data)
      const finalResult = results[results.length - 1];
      const recordsProcessed = finalResult.succeeded || finalResult.total || sourceData.length;
      
      // Update execution as complete
      await query(
        `UPDATE task_executions 
         SET status = 'success', 
             completed_at = NOW(), 
             records_processed = $1,
             records_read = $2,
             records_written = $3,
             records_failed = $4
         WHERE id = $5`,
        [
          recordsProcessed,
          sourceData.length,
          finalResult.succeeded || 0,
          finalResult.failed || 0,
          executionId
        ]
      );

      await writeLog(executionId, 'success', 'Task completed successfully');
      
    } finally {
      // Close target connection
      await closeConnection(targetConn, task.target_type);
    }

  } catch (error) {
    console.error('Task execution failed:', error);
    
    await writeLog(
      executionId, 
      'error', 
      `Task failed: ${error.message}`,
      { stack: error.stack }
    );
    
    await query(
      `UPDATE task_executions 
       SET status = 'failed', 
           completed_at = NOW(), 
           error_message = $1 
       WHERE id = $2`,
      [error.message, executionId]
    );
  }
}

// Extract data from source
async function extractData(task) {
  const { source_type, source_config, source_query, source_worksheet, source_type: queryType } = task;

  if (source_type === 'postgresql') {
    return await extractPostgreSQL(source_config, source_query);
  } else if (source_type === 'mysql') {
    return await extractMySQL(source_config, source_query);
  } else if (source_type === 'oracle') {
    return await extractOracle(source_config, source_query);
  } else if (source_type === 'sqlserver') {
    return await sqlserver.extractData(source_config, source_query);
  } else if (source_type === 'vertica') {
    return await vertica.extractData(source_config, source_query);
  } else if (source_type === 'cockroachdb') {
    return await cockroachdb.extractData(source_config, source_query);
  } else if (source_type === 'salesforce') {
    if (queryType === 'soql') {
      return await salesforce.extractDataSOQL(source_config, source_query);
    } else {
      // Object mode: source_query = objectName, source_worksheet = fields
      return await salesforce.extractDataObject(source_config, source_query, source_worksheet);
    }
  } else if (source_type === 'servicenow') {
    // source_query = tableName, source_worksheet = query filter
    return await servicenow.extractData(source_config, source_query, source_worksheet);
  } else if (source_type === 'excel') {
    return await extractExcel(source_config, source_worksheet);
  } else if (source_type === 'csv') {
    return await extractCSV(source_config);
  } else {
    throw new Error(`Unsupported source type: ${source_type}`);
  }
}

// PostgreSQL extraction
async function extractPostgreSQL(config, queryText) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password
  });

  try {
    const result = await pool.query(queryText);
    return result.rows;
  } finally {
    await pool.end();
  }
}

// MySQL extraction
async function extractMySQL(config, queryText) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port || 3306,
    database: config.database,
    user: config.username,
    password: config.password
  });

  try {
    const [rows] = await connection.execute(queryText);
    return rows;
  } finally {
    await connection.end();
  }
}

// Oracle extraction
async function extractOracle(config, queryText) {
  const oracledb = require('oracledb');
  
  const connection = await oracledb.getConnection({
    user: config.username,
    password: config.password,
    connectString: `${config.host}:${config.port || 1521}/${config.service_name || config.database}`
  });

  try {
    const result = await connection.execute(queryText, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });
    return result.rows;
  } finally {
    await connection.close();
  }
}

// Excel extraction
async function extractExcel(config, worksheetName) {
  const XLSX = require('xlsx');
  const fs = require('fs');
  
  const workbook = XLSX.readFile(config.filePath);
  const worksheet = workbook.Sheets[worksheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

// CSV extraction
async function extractCSV(config) {
  const Papa = require('papaparse');
  const fs = require('fs');
  
  const fileContent = fs.readFileSync(config.filePath, 'utf8');
  const parsed = Papa.parse(fileContent, { header: true });
  return parsed.data;
}

// Get database connection
async function getConnection(dbType, config) {
  if (dbType === 'postgresql') {
    const pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password
    });
    
    // Wrap pool.query to match expected interface
    return {
      query: (text, params) => pool.query(text, params),
      _pool: pool
    };
  } else if (dbType === 'mysql') {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password
    });
    
    return {
      query: async (text, params) => {
        const [rows] = await connection.execute(text, params);
        return { rows };
      },
      _connection: connection
    };
  } else if (dbType === 'oracle') {
    const oracledb = require('oracledb');
    
    const connection = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: `${config.host}:${config.port || 1521}/${config.service_name || config.database}`
    });
    
    return {
      query: async (text, params) => {
        const result = await connection.execute(text, params, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          autoCommit: true
        });
        return { rows: result.rows };
      },
      _connection: connection
    };
  } else if (dbType === 'sqlserver') {
    return await sqlserver.getConnection(config);
  } else if (dbType === 'vertica') {
    return await vertica.getConnection(config);
  } else if (dbType === 'cockroachdb') {
    return await cockroachdb.getConnection(config);
  } else if (dbType === 'salesforce') {
    return await salesforce.getConnection(config);
  } else if (dbType === 'servicenow') {
    return await servicenow.getConnection(config);
  }

  throw new Error(`Unsupported database type: ${dbType}`);
}


// Close database connection
async function closeConnection(conn, dbType) {
  if (dbType === 'postgresql' && conn._pool) {
    await conn._pool.end();
  } else if ((dbType === 'mysql' || dbType === 'oracle') && conn._connection) {
    await conn._connection.close ? conn._connection.close() : conn._connection.end();
  } else if (dbType === 'sqlserver') {
    await sqlserver.closeConnection(conn);
  } else if (dbType === 'vertica') {
    await vertica.closeConnection(conn);
  } else if (dbType === 'cockroachdb') {
    await cockroachdb.closeConnection(conn);
  } else if (dbType === 'salesforce') {
    await salesforce.closeConnection(conn);
  } else if (dbType === 'servicenow') {
    await servicenow.closeConnection(conn);
  }
}
