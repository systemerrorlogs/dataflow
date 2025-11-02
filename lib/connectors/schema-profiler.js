// File: lib/connectors/schema-profiler-enhanced.js
// Enhanced version with support for SQL Server, Vertica, CockroachDB

/**
 * Profile JSON data array to determine column types
 * @param {Array} data - Array of JSON objects
 * @param {String} dbType - 'postgresql', 'mysql', 'oracle', 'sqlserver', 'vertica', 'cockroachdb'
 * @returns {Array} Column definitions with {name, type, nullable}
 */
function profileSchema(data, dbType) {
  if (!data || data.length === 0) {
    throw new Error('No data to profile');
  }

  const sampleSize = Math.min(1000, data.length);
  const sample = data.slice(0, sampleSize);
  
  const columns = {};
  
  // Analyze each row
  for (const row of sample) {
    for (const [key, value] of Object.entries(row)) {
      if (!columns[key]) {
        columns[key] = {
          name: key,
          nullable: false,
          types: new Set(),
          maxLength: 0,
          minValue: null,
          maxValue: null,
          hasDecimals: false,
          decimalPlaces: 0
        };
      }
      
      analyzeValue(columns[key], value);
    }
  }
  
  // Convert analysis to database types
  return Object.values(columns).map(col => ({
    name: col.name,
    type: inferDatabaseType(col, dbType),
    nullable: col.nullable
  }));
}

/**
 * Analyze a single value and update column metadata
 */
function analyzeValue(column, value) {
  if (value === null || value === undefined) {
    column.nullable = true;
    return;
  }
  
  const type = typeof value;
  column.types.add(type);
  
  if (type === 'string') {
    column.maxLength = Math.max(column.maxLength, value.length);
    
    // Check if it's a date/timestamp
    if (isISO8601(value)) {
      column.types.add('timestamp');
    } else if (isDateString(value)) {
      column.types.add('date');
    }
  } else if (type === 'number') {
    // Track numeric range
    if (column.minValue === null || value < column.minValue) {
      column.minValue = value;
    }
    if (column.maxValue === null || value > column.maxValue) {
      column.maxValue = value;
    }
    
    // Check for decimals
    if (!Number.isInteger(value)) {
      column.hasDecimals = true;
      const decimalStr = value.toString().split('.')[1];
      if (decimalStr) {
        column.decimalPlaces = Math.max(column.decimalPlaces, decimalStr.length);
      }
    }
  } else if (type === 'boolean') {
    column.types.add('boolean');
  } else if (type === 'object') {
    if (Array.isArray(value)) {
      column.types.add('array');
    } else if (value instanceof Date) {
      column.types.add('timestamp');
    } else {
      column.types.add('object');
    }
  }
}

/**
 * Infer the best database type for a column based on database type
 */
function inferDatabaseType(column, dbType) {
  const types = column.types;
  
  // Complex types (JSON/JSONB)
  if (types.has('object') || types.has('array')) {
    return inferJSONType(dbType);
  }
  
  // Timestamps
  if (types.has('timestamp')) {
    return inferTimestampType(dbType);
  }
  
  // Dates
  if (types.has('date')) {
    return 'DATE';
  }
  
  // Numbers
  if (types.has('number')) {
    return inferNumericType(column, dbType);
  }
  
  // Booleans
  if (types.has('boolean')) {
    return inferBooleanType(dbType);
  }
  
  // Strings
  if (types.has('string') || types.size === 0) {
    return inferStringType(column, dbType);
  }
  
  // Default fallback
  return inferStringType({ maxLength: 255 }, dbType);
}

/**
 * Infer JSON/JSONB type
 */
function inferJSONType(dbType) {
  switch (dbType) {
    case 'postgresql':
      return 'JSONB';
    case 'mysql':
      return 'JSON';
    case 'sqlserver':
      return 'NVARCHAR(MAX)';
    case 'vertica':
      return 'VARCHAR(65000)';
    case 'cockroachdb':
      return 'JSONB';
    case 'oracle':
      return 'CLOB';
    default:
      return 'TEXT';
  }
}

/**
 * Infer timestamp type
 */
function inferTimestampType(dbType) {
  switch (dbType) {
    case 'postgresql':
      return 'TIMESTAMP WITH TIME ZONE';
    case 'mysql':
      return 'DATETIME';
    case 'sqlserver':
      return 'DATETIME2';
    case 'vertica':
      return 'TIMESTAMPTZ';
    case 'cockroachdb':
      return 'TIMESTAMPTZ';
    case 'oracle':
      return 'TIMESTAMP';
    default:
      return 'TIMESTAMP';
  }
}

/**
 * Infer numeric type
 */
function inferNumericType(column, dbType) {
  if (column.hasDecimals) {
    // Decimal/Float types
    const precision = 18;
    const scale = Math.min(column.decimalPlaces, 4);
    
    switch (dbType) {
      case 'oracle':
        return `NUMBER(${precision},${scale})`;
      case 'sqlserver':
        return `DECIMAL(${precision},${scale})`;
      case 'vertica':
        return `NUMERIC(${precision},${scale})`;
      case 'cockroachdb':
        return `DECIMAL(${precision},${scale})`;
      default:
        return `NUMERIC(${precision},${scale})`;
    }
  }
  
  // Integer types - size based on range
  const maxAbs = Math.max(
    Math.abs(column.minValue || 0), 
    Math.abs(column.maxValue || 0)
  );
  
  switch (dbType) {
    case 'oracle':
      return maxAbs > 2147483647 ? 'NUMBER(19,0)' : 'NUMBER(10,0)';
    
    case 'sqlserver':
      if (maxAbs > 2147483647) return 'BIGINT';
      if (maxAbs > 32767) return 'INT';
      return 'SMALLINT';
    
    case 'vertica':
      if (maxAbs > 2147483647) return 'BIGINT';
      if (maxAbs > 32767) return 'INTEGER';
      return 'SMALLINT';
    
    case 'cockroachdb':
      return maxAbs > 2147483647 ? 'INT8' : 'INT';
    
    default:
      if (maxAbs > 2147483647) return 'BIGINT';
      if (maxAbs > 32767) return 'INTEGER';
      return 'SMALLINT';
  }
}

/**
 * Infer boolean type
 */
function inferBooleanType(dbType) {
  switch (dbType) {
    case 'oracle':
      return 'NUMBER(1)';
    case 'sqlserver':
      return 'BIT';
    case 'cockroachdb':
      return 'BOOL';
    default:
      return 'BOOLEAN';
  }
}

/**
 * Infer string type
 */
function inferStringType(column, dbType) {
  const maxLength = column.maxLength || 255;
  
  switch (dbType) {
    case 'oracle':
      return maxLength > 4000 ? 'CLOB' : 'VARCHAR2(4000)';
    
    case 'sqlserver':
      if (maxLength > 4000) return 'NVARCHAR(MAX)';
      if (maxLength > 255) return 'NVARCHAR(1000)';
      return 'NVARCHAR(255)';
    
    case 'vertica':
      if (maxLength > 65000) return 'LONG VARCHAR';
      if (maxLength > 255) return 'VARCHAR(1000)';
      return 'VARCHAR(255)';
    
    case 'cockroachdb':
      if (maxLength > 1000) return 'STRING';
      if (maxLength > 255) return 'STRING(1000)';
      return 'STRING(255)';
    
    case 'mysql':
      if (maxLength > 65535) return 'LONGTEXT';
      if (maxLength > 16383) return 'TEXT';
      if (maxLength > 255) return 'VARCHAR(1000)';
      return 'VARCHAR(255)';
    
    default: // postgresql
      if (maxLength > 10000) return 'TEXT';
      if (maxLength > 255) return 'VARCHAR(1000)';
      return 'VARCHAR(255)';
  }
}

/**
 * Check if string is ISO 8601 timestamp
 */
function isISO8601(str) {
  if (typeof str !== 'string') return false;
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  return iso8601Regex.test(str);
}

/**
 * Check if string is a date (YYYY-MM-DD)
 */
function isDateString(str) {
  if (typeof str !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(str)) return false;
  
  // Verify it's a valid date
  const date = new Date(str);
  return date instanceof Date && !isNaN(date);
}

module.exports = { profileSchema };
