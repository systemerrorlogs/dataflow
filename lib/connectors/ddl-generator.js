// File: lib/connectors/ddl-generator.js

/**
 * Generate CREATE TABLE DDL statement
 * @param {String} tableName 
 * @param {Array} columns - Array from profileSchema: [{name, type, nullable}]
 * @param {String} dbType - 'postgresql', 'mysql', or 'oracle'
 * @returns {String} DDL statement
 */
function generateCreateTable(tableName, columns, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  
  const columnDefs = columns.map(col => {
    const quotedName = quoteIdentifier(col.name, dbType);
    const nullable = col.nullable ? '' : ' NOT NULL';
    return `  ${quotedName} ${col.type}${nullable}`;
  });
  
  // Check if columns already have an ID
  const hasId = columns.some(c => c.name.toLowerCase() === 'id');
  
  // Check if columns already have created_at
  const hasCreatedAt = columns.some(c => 
    c.name.toLowerCase() === 'created_at' || 
    c.name.toLowerCase() === 'createdat'
  );
  
  let idColumn = '';
  let createdAtColumn = '';
  
  // Add auto-increment ID if not present
  if (!hasId) {
    if (dbType === 'postgresql') {
      idColumn = '  id SERIAL PRIMARY KEY,\n';
    } else if (dbType === 'mysql') {
      idColumn = '  id INT AUTO_INCREMENT PRIMARY KEY,\n';
    } else if (dbType === 'oracle') {
      idColumn = '  id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n';
    }
  }
  
  // Add created_at timestamp if not present
  if (!hasCreatedAt) {
    if (dbType === 'postgresql' || dbType === 'mysql') {
      createdAtColumn = ',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    } else if (dbType === 'oracle') {
      createdAtColumn = ',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }
  }
  
  const ddl = `CREATE TABLE ${quotedTable} (
${idColumn}${columnDefs.join(',\n')}${createdAtColumn}
)`;
  
  return ddl;
}

/**
 * Generate ALTER TABLE statements to add missing columns
 * @param {String} tableName
 * @param {Array} newColumns - Columns to add: [{name, type, nullable}]
 * @param {String} dbType
 * @returns {Array<String>} Array of ALTER TABLE statements
 */
function generateAddColumns(tableName, newColumns, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  
  return newColumns.map(col => {
    const quotedName = quoteIdentifier(col.name, dbType);
    const nullable = col.nullable ? ' NULL' : ' NOT NULL';
    
    if (dbType === 'oracle') {
      return `ALTER TABLE ${quotedTable} ADD ${quotedName} ${col.type}${nullable}`;
    }
    
    // PostgreSQL and MySQL
    return `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedName} ${col.type}${nullable}`;
  });
}

/**
 * Generate DROP TABLE statement
 * @param {String} tableName
 * @param {String} dbType
 * @returns {String} DROP TABLE statement
 */
function generateDropTable(tableName, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  
  if (dbType === 'oracle') {
    // Oracle doesn't have IF EXISTS in older versions
    return `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${quotedTable}'; EXCEPTION WHEN OTHERS THEN NULL; END;`;
  }
  
  return `DROP TABLE IF EXISTS ${quotedTable}`;
}

/**
 * Generate TRUNCATE TABLE statement
 * @param {String} tableName
 * @param {String} dbType
 * @returns {String} TRUNCATE TABLE statement
 */
function generateTruncateTable(tableName, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  return `TRUNCATE TABLE ${quotedTable}`;
}

/**
 * Quote identifier based on database type
 * @param {String} identifier - Table or column name
 * @param {String} dbType - 'postgresql', 'mysql', or 'oracle'
 * @returns {String} Quoted identifier
 */
function quoteIdentifier(identifier, dbType) {
  if (dbType === 'mysql') {
    // MySQL uses backticks
    return `\`${identifier}\``;
  }
  
  // PostgreSQL and Oracle use double quotes
  return `"${identifier}"`;
}

/**
 * Generate INSERT statement
 * @param {String} tableName
 * @param {Object} row - Data row as key-value pairs
 * @param {String} dbType
 * @returns {Object} {sql, values}
 */
function generateInsert(tableName, row, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  const columns = Object.keys(row).map(k => quoteIdentifier(k, dbType));
  const values = Object.values(row);
  
  // Create placeholders based on DB type
  const placeholders = values.map((_, i) => {
    if (dbType === 'postgresql') return `$${i + 1}`;
    if (dbType === 'mysql') return '?';
    return `:${i + 1}`; // Oracle
  });

  const sql = `INSERT INTO ${quotedTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  
  return { sql, values };
}

/**
 * Generate UPSERT statement (INSERT ... ON CONFLICT or INSERT ... ON DUPLICATE KEY)
 * @param {String} tableName
 * @param {Object} row - Data row
 * @param {String} keyColumn - Primary key column name
 * @param {String} dbType
 * @returns {Object} {sql, values}
 */
function generateUpsert(tableName, row, keyColumn, dbType) {
  const quotedTable = quoteIdentifier(tableName, dbType);
  const columns = Object.keys(row);
  const quotedCols = columns.map(k => quoteIdentifier(k, dbType));
  const values = Object.values(row);
  
  let sql;
  
  if (dbType === 'postgresql') {
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const updateSet = quotedCols
      .filter(col => col !== quoteIdentifier(keyColumn, dbType))
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');
    
    sql = `
      INSERT INTO ${quotedTable} (${quotedCols.join(', ')}) 
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (${quoteIdentifier(keyColumn, dbType)}) 
      DO UPDATE SET ${updateSet}
    `;
  } else if (dbType === 'mysql') {
    const placeholders = values.map(() => '?');
    const updateSet = quotedCols
      .filter(col => col !== quoteIdentifier(keyColumn, dbType))
      .map(col => `${col} = VALUES(${col})`)
      .join(', ');
    
    sql = `
      INSERT INTO ${quotedTable} (${quotedCols.join(', ')}) 
      VALUES (${placeholders.join(', ')})
      ON DUPLICATE KEY UPDATE ${updateSet}
    `;
  } else if (dbType === 'oracle') {
    // Oracle MERGE statement
    const keyQuoted = quoteIdentifier(keyColumn, dbType);
    const placeholders = values.map((_, i) => `:${i + 1}`);
    const updateSet = quotedCols
      .filter(col => col !== keyQuoted)
      .map((col, i) => `${col} = :${i + 1}`)
      .join(', ');
    
    sql = `
      MERGE INTO ${quotedTable} target
      USING (SELECT ${placeholders.join(', ')} FROM dual) source
      ON (target.${keyQuoted} = source.${keyQuoted})
      WHEN MATCHED THEN UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN INSERT (${quotedCols.join(', ')}) VALUES (${placeholders.join(', ')})
    `;
  }
  
  return { sql, values };
}

module.exports = {
  generateCreateTable,
  generateAddColumns,
  generateDropTable,
  generateTruncateTable,
  generateInsert,
  generateUpsert,
  quoteIdentifier
};
