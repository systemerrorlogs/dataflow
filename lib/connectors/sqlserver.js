// File: lib/connectors/sqlserver.js

const sql = require('mssql');

/**
 * SQL Server Connector
 */

/**
 * Test SQL Server connection
 */
async function testConnection(config) {
  const poolConfig = {
    user: config.username,
    password: config.password,
    server: config.host,
    port: config.port || 1433,
    database: config.database,
    options: {
      encrypt: config.encrypt !== false, // Use encryption by default
      trustServerCertificate: config.trustServerCertificate || false,
      connectTimeout: 5000
    }
  };

  try {
    const pool = await sql.connect(poolConfig);
    const result = await pool.request().query('SELECT @@VERSION as version');
    await pool.close();
    
    return {
      success: true,
      message: 'SQL Server connection successful',
      version: result.recordset[0].version,
      dbType: 'SQL Server'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        number: error.number
      }
    };
  }
}

/**
 * Extract data from SQL Server
 */
async function extractData(config, queryText) {
  const poolConfig = {
    user: config.username,
    password: config.password,
    server: config.host,
    port: config.port || 1433,
    database: config.database,
    options: {
      encrypt: config.encrypt !== false,
      trustServerCertificate: config.trustServerCertificate || false
    }
  };

  const pool = await sql.connect(poolConfig);
  
  try {
    const result = await pool.request().query(queryText);
    return result.recordset; // Array of objects
  } finally {
    await pool.close();
  }
}

/**
 * Get database connection wrapper
 */
async function getConnection(config) {
  const poolConfig = {
    user: config.username,
    password: config.password,
    server: config.host,
    port: config.port || 1433,
    database: config.database,
    options: {
      encrypt: config.encrypt !== false,
      trustServerCertificate: config.trustServerCertificate || false
    }
  };

  const pool = await sql.connect(poolConfig);
  
  return {
    query: async (text, params = []) => {
      const request = pool.request();
      
      // Bind parameters (SQL Server uses @p1, @p2, etc.)
      params.forEach((param, index) => {
        request.input(`p${index + 1}`, param);
      });
      
      // Replace $1, $2, etc. with @p1, @p2 for SQL Server
      const sqlServerQuery = text.replace(/\$(\d+)/g, '@p$1');
      
      const result = await request.query(sqlServerQuery);
      return { rows: result.recordset };
    },
    _pool: pool
  };
}

/**
 * Close connection
 */
async function closeConnection(conn) {
  if (conn._pool) {
    await conn._pool.close();
  }
}

/**
 * Get SQL Server specific data type
 */
function getSQLServerType(genericType) {
  const typeMap = {
    'VARCHAR(255)': 'NVARCHAR(255)',
    'VARCHAR(1000)': 'NVARCHAR(1000)',
    'TEXT': 'NVARCHAR(MAX)',
    'INTEGER': 'INT',
    'BIGINT': 'BIGINT',
    'SMALLINT': 'SMALLINT',
    'NUMERIC(18,4)': 'DECIMAL(18,4)',
    'BOOLEAN': 'BIT',
    'TIMESTAMP': 'DATETIME2',
    'TIMESTAMP WITH TIME ZONE': 'DATETIMEOFFSET',
    'DATE': 'DATE',
    'JSONB': 'NVARCHAR(MAX)', // JSON stored as text
    'JSON': 'NVARCHAR(MAX)'
  };
  
  return typeMap[genericType] || 'NVARCHAR(MAX)';
}

/**
 * Generate CREATE TABLE for SQL Server
 */
function generateCreateTable(tableName, columns) {
  const quotedTable = `[${tableName}]`;
  
  const columnDefs = columns.map(col => {
    const quotedName = `[${col.name}]`;
    const sqlServerType = getSQLServerType(col.type);
    const nullable = col.nullable ? 'NULL' : 'NOT NULL';
    return `  ${quotedName} ${sqlServerType} ${nullable}`;
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
    idColumn = '  id INT IDENTITY(1,1) PRIMARY KEY,\n';
  }
  
  if (!hasCreatedAt) {
    createdAtColumn = ',\n  created_at DATETIME2 DEFAULT GETDATE()';
  }
  
  return `CREATE TABLE ${quotedTable} (
${idColumn}${columnDefs.join(',\n')}${createdAtColumn}
)`;
}

/**
 * Generate ALTER TABLE to add columns
 */
function generateAddColumns(tableName, columns) {
  const quotedTable = `[${tableName}]`;
  
  return columns.map(col => {
    const quotedName = `[${col.name}]`;
    const sqlServerType = getSQLServerType(col.type);
    const nullable = col.nullable ? 'NULL' : 'NOT NULL';
    
    return `ALTER TABLE ${quotedTable} ADD ${quotedName} ${sqlServerType} ${nullable}`;
  });
}

/**
 * Quote identifier
 */
function quoteIdentifier(identifier) {
  return `[${identifier}]`;
}

module.exports = {
  testConnection,
  extractData,
  getConnection,
  closeConnection,
  generateCreateTable,
  generateAddColumns,
  quoteIdentifier,
  getSQLServerType
};
