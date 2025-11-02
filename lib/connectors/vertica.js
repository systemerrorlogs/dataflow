// File: lib/connectors/vertica.js

const vertica = require('vertica');

/**
 * Vertica Connector
 * Vertica uses a PostgreSQL-compatible driver
 */

/**
 * Test Vertica connection
 */
async function testConnection(config) {
  const connConfig = {
    host: config.host,
    port: config.port || 5433,
    user: config.username,
    password: config.password,
    database: config.database
  };

  return new Promise((resolve) => {
    const connection = vertica.connect(connConfig, (err) => {
      if (err) {
        resolve({
          success: false,
          error: err.message,
          details: { code: err.code }
        });
        return;
      }

      connection.query('SELECT VERSION()', (err, result) => {
        connection.disconnect();
        
        if (err) {
          resolve({
            success: false,
            error: err.message
          });
          return;
        }

        resolve({
          success: true,
          message: 'Vertica connection successful',
          version: result.rows[0].version || result.rows[0].VERSION,
          dbType: 'Vertica'
        });
      });
    });
  });
}

/**
 * Extract data from Vertica
 */
async function extractData(config, queryText) {
  const connConfig = {
    host: config.host,
    port: config.port || 5433,
    user: config.username,
    password: config.password,
    database: config.database
  };

  return new Promise((resolve, reject) => {
    const connection = vertica.connect(connConfig, (err) => {
      if (err) {
        reject(err);
        return;
      }

      connection.query(queryText, (err, result) => {
        connection.disconnect();
        
        if (err) {
          reject(err);
          return;
        }

        resolve(result.rows);
      });
    });
  });
}

/**
 * Get database connection wrapper
 */
async function getConnection(config) {
  const connConfig = {
    host: config.host,
    port: config.port || 5433,
    user: config.username,
    password: config.password,
    database: config.database
  };

  return new Promise((resolve, reject) => {
    const connection = vertica.connect(connConfig, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        query: (text, params = []) => {
          return new Promise((resolve, reject) => {
            connection.query(text, params, (err, result) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({ rows: result.rows });
            });
          });
        },
        _connection: connection
      });
    });
  });
}

/**
 * Close connection
 */
async function closeConnection(conn) {
  if (conn._connection) {
    conn._connection.disconnect();
  }
}

/**
 * Get Vertica specific data type
 */
function getVerticaType(genericType) {
  const typeMap = {
    'VARCHAR(255)': 'VARCHAR(255)',
    'VARCHAR(1000)': 'VARCHAR(1000)',
    'TEXT': 'VARCHAR(65000)',
    'INTEGER': 'INTEGER',
    'BIGINT': 'BIGINT',
    'SMALLINT': 'SMALLINT',
    'NUMERIC(18,4)': 'NUMERIC(18,4)',
    'BOOLEAN': 'BOOLEAN',
    'TIMESTAMP': 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMPTZ',
    'DATE': 'DATE',
    'JSONB': 'VARCHAR(65000)', // JSON stored as text
    'JSON': 'VARCHAR(65000)'
  };
  
  return typeMap[genericType] || 'VARCHAR(65000)';
}

/**
 * Generate CREATE TABLE for Vertica
 */
function generateCreateTable(tableName, columns) {
  const quotedTable = `"${tableName}"`;
  
  const columnDefs = columns.map(col => {
    const quotedName = `"${col.name}"`;
    const verticaType = getVerticaType(col.type);
    const nullable = col.nullable ? '' : ' NOT NULL';
    return `  ${quotedName} ${verticaType}${nullable}`;
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
    // Vertica doesn't have SERIAL, use AUTO_INCREMENT
    idColumn = '  id AUTO_INCREMENT PRIMARY KEY,\n';
  }
  
  if (!hasCreatedAt) {
    createdAtColumn = ',\n  created_at TIMESTAMP DEFAULT NOW()';
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
    const verticaType = getVerticaType(col.type);
    const nullable = col.nullable ? ' NULL' : ' NOT NULL';
    
    return `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedName} ${verticaType}${nullable}`;
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
  getVerticaType
};
