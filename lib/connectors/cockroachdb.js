// File: lib/connectors/cockroachdb.js

const { Pool } = require('pg');

/**
 * CockroachDB Connector
 * CockroachDB is PostgreSQL-compatible, so we use the pg driver
 */

/**
 * Test CockroachDB connection
 */
async function testConnection(config) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 26257,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    
    return {
      success: true,
      message: 'CockroachDB connection successful',
      version: result.rows[0].version,
      dbType: 'CockroachDB'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        hint: error.hint
      }
    };
  } finally {
    await pool.end();
  }
}

/**
 * Extract data from CockroachDB
 */
async function extractData(config, queryText) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 26257,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl !== false ? { rejectUnauthorized: false } : false
  });

  try {
    const result = await pool.query(queryText);
    return result.rows;
  } finally {
    await pool.end();
  }
}

/**
 * Get database connection wrapper
 */
async function getConnection(config) {
  const pool = new Pool({
    host: config.host,
    port: config.port || 26257,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl !== false ? { rejectUnauthorized: false } : false
  });
  
  return {
    query: (text, params) => pool.query(text, params),
    _pool: pool
  };
}

/**
 * Close connection
 */
async function closeConnection(conn) {
  if (conn._pool) {
    await conn._pool.end();
  }
}

/**
 * Get CockroachDB specific data type
 * CockroachDB is mostly PostgreSQL-compatible, with some differences
 */
function getCockroachDBType(genericType) {
  const typeMap = {
    'VARCHAR(255)': 'STRING(255)',
    'VARCHAR(1000)': 'STRING(1000)',
    'TEXT': 'STRING',
    'INTEGER': 'INT',
    'BIGINT': 'INT8',
    'SMALLINT': 'INT2',
    'NUMERIC(18,4)': 'DECIMAL(18,4)',
    'BOOLEAN': 'BOOL',
    'TIMESTAMP': 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMPTZ',
    'DATE': 'DATE',
    'JSONB': 'JSONB',
    'JSON': 'JSONB' // CockroachDB uses JSONB
  };
  
  return typeMap[genericType] || 'STRING';
}

/**
 * Generate CREATE TABLE for CockroachDB
 */
function generateCreateTable(tableName, columns) {
  const quotedTable = `"${tableName}"`;
  
  const columnDefs = columns.map(col => {
    const quotedName = `"${col.name}"`;
    const cockroachType = getCockroachDBType(col.type);
    const nullable = col.nullable ? '' : ' NOT NULL';
    return `  ${quotedName} ${cockroachType}${nullable}`;
  });
  
  // Check for ID column
  const hasId = columns.some(c => c.name.toLowerCase() === 'id');
  const hasCreatedAt = columns.some(c => 
    c.name.toLowerCase() === 'created_at' || 
    c.name.toLowerCase() === 'createdat'
  );
  
  let idColumn = '';
  let createdAtColumn = '';
  
  if (!hasId) {
    // CockroachDB uses unique_rowid() for auto-incrementing IDs
    idColumn = '  id INT8 DEFAULT unique_rowid() PRIMARY KEY,\n';
  }
  
  if (!hasCreatedAt) {
    createdAtColumn = ',\n  created_at TIMESTAMP DEFAULT now()';
  }
  
  return `CREATE TABLE ${quotedTable} (
${idColumn}${columnDefs.join(',\n')}${createdAtColumn}
)`;
}

/**
 * Generate ALTER TABLE to add columns
 */
function generateAddColumns(tableName, columns) {
  const quotedTable = `"${tableName}"`;
  
  return columns.map(col => {
    const quotedName = `"${col.name}"`;
    const cockroachType = getCockroachDBType(col.type);
    const nullable = col.nullable ? ' NULL' : ' NOT NULL';
    
    return `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedName} ${cockroachType}${nullable}`;
  });
}

/**
 * Quote identifier
 */
function quoteIdentifier(identifier) {
  return `"${identifier}"`;
}

module.exports = {
  testConnection,
  extractData,
  getConnection,
  closeConnection,
  generateCreateTable,
  generateAddColumns,
  quoteIdentifier,
  getCockroachDBType
};
