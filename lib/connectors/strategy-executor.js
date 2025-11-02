// File: lib/connectors/strategy-executor.js

const { profileSchema } = require('./schema-profiler');
const { generateCreateTable, generateAddColumns, quoteIdentifier } = require('./ddl-generator');

class StrategyExecutor {
  constructor(sourceData, targetConnection, targetTable, dbType) {
    this.sourceData = sourceData;
    this.connection = targetConnection;
    this.tableName = targetTable;
    this.dbType = dbType;
    this.tableExists = null; // Cache existence check
    this.sourceSchema = null; // Cache profiled schema
  }

  /**
   * Execute a pipeline of strategies in order
   * @param {Array<string>} strategies - Array of strategy names
   * @returns {Array} Results of each strategy execution
   */
  async execute(strategies) {
    const results = [];
    
    for (const strategy of strategies) {

      try {
        const result = await this.executeStrategy(strategy);
        results.push({ strategy, success: true, ...result });
      } catch (error) {
        console.error(`Strategy ${strategy} failed:`, error);
        results.push({ strategy, success: false, error: error.message });
        throw error; // Stop execution on first failure
      }
    }
    
    return results;
  }

  /**
   * Execute a single strategy
   */
  async executeStrategy(strategy) {
    switch (strategy) {
      case 'check_exists':
        return await this.checkTableExists();
      
      case 'create_table':
        return await this.createTable();
      
      case 'drop_table':
        return await this.dropTable();
      
      case 'truncate_table':
        return await this.truncateTable();
      
      case 'alter_add_columns':
        return await this.addMissingColumns();
      
      case 'append_data':
        return await this.appendData();
      
      case 'upsert_data':
        return await this.upsertData();
      
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * Check if table exists in the database
   */
  async checkTableExists() {
    if (this.tableExists !== null) {
      return { exists: this.tableExists };
    }

    let queryText;
    let params = [this.tableName];
    
    if (this.dbType === 'postgresql') {
      queryText = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists
      `;
    } else if (this.dbType === 'mysql') {
      queryText = `
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_name = ?
      `;
    } else if (this.dbType === 'oracle') {
      queryText = `
        SELECT COUNT(*) as count 
        FROM user_tables 
        WHERE table_name = UPPER(:1)
      `;
      params = [this.tableName.toUpperCase()];
    }

    const result = await this.connection.query(queryText, params);
    
    if (this.dbType === 'postgresql') {
      this.tableExists = result.rows[0].exists;
    } else {
      this.tableExists = parseInt(result.rows[0].count) > 0;
    }
    
    return { exists: this.tableExists };
  }

  /**
   * Create table from source data schema
   */
  async createTable() {
    // Check if table already exists
    const { exists } = await this.checkTableExists();
    if (exists) {
      return { created: false, reason: 'already_exists' };
    }

    // Profile source schema if not already done
    if (!this.sourceSchema) {
      this.sourceSchema = profileSchema(this.sourceData, this.dbType);
    }

    // Generate DDL
    const ddl = generateCreateTable(this.tableName, this.sourceSchema, this.dbType);

    // Execute DDL
    await this.connection.query(ddl);
    this.tableExists = true;

    return { 
      created: true, 
      columns: this.sourceSchema.length,
      ddl 
    };
  }

  /**
   * Drop table if it exists
   */
  async dropTable() {
    const quotedTable = quoteIdentifier(this.tableName, this.dbType);
    
    let ddl;
    if (this.dbType === 'oracle') {
      // Oracle doesn't support IF EXISTS in older versions
      ddl = `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${quotedTable}'; EXCEPTION WHEN OTHERS THEN NULL; END;`;
    } else {
      ddl = `DROP TABLE IF EXISTS ${quotedTable}`;
    }
    
    await this.connection.query(ddl);
    this.tableExists = false;

    return { dropped: true };
  }

  /**
   * Truncate table (delete all rows)
   */
  async truncateTable() {
    const quotedTable = quoteIdentifier(this.tableName, this.dbType);
    const sql = `TRUNCATE TABLE ${quotedTable}`;
    
    await this.connection.query(sql);

    return { truncated: true };
  }

  /**
   * Add missing columns to existing table
   */
  async addMissingColumns() {
    // Check table exists
    const { exists } = await this.checkTableExists();
    if (!exists) {
      return { added: 0, reason: 'table_not_exists' };
    }

    // Profile source schema if not already done
    if (!this.sourceSchema) {
      this.sourceSchema = profileSchema(this.sourceData, this.dbType);
    }

    // Get existing columns
    const existingColumns = await this.getExistingColumns();
    const existingNames = new Set(existingColumns.map(c => c.toLowerCase()));

    // Find missing columns
    const missingColumns = this.sourceSchema.filter(
      col => !existingNames.has(col.name.toLowerCase())
    );

    if (missingColumns.length === 0) {
      return { added: 0 };
    }

    // Generate ALTER statements
    const alterStatements = generateAddColumns(
      this.tableName, 
      missingColumns, 
      this.dbType
    );

    // Execute each ALTER
    for (const stmt of alterStatements) {
      await this.connection.query(stmt);
    }

    return { 
      added: missingColumns.length,
      columns: missingColumns.map(c => c.name)
    };
  }

  /**
   * Get list of existing columns in the table
   */
  async getExistingColumns() {
    let queryText;
    let params = [this.tableName];
    
    if (this.dbType === 'postgresql') {
      queryText = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position
      `;
    } else if (this.dbType === 'mysql') {
      queryText = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE()
        AND table_name = ?
        ORDER BY ordinal_position
      `;
    } else if (this.dbType === 'oracle') {
      queryText = `
        SELECT column_name 
        FROM user_tab_columns 
        WHERE table_name = UPPER(:1)
        ORDER BY column_id
      `;
      params = [this.tableName.toUpperCase()];
    }

    const result = await this.connection.query(queryText, params);
    return result.rows.map(r => r.column_name || r.COLUMN_NAME);
  }

  /**
   * Append data to table (INSERT)
   */
  async appendData() {
    // Profile schema to ensure we know column types
    if (!this.sourceSchema) {
      this.sourceSchema = profileSchema(this.sourceData, this.dbType);
    }

    const quotedTable = quoteIdentifier(this.tableName, this.dbType);
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const row of this.sourceData) {
      try {
        const columns = Object.keys(row).map(k => quoteIdentifier(k, this.dbType));
        const values = Object.values(row);
        
        // Create placeholders ($1, $2, ... or ?, ?, ...)
        const placeholders = values.map((_, i) => {
          if (this.dbType === 'postgresql') return `$${i + 1}`;
          if (this.dbType === 'mysql') return '?';
          return `:${i + 1}`; // Oracle
        });

        const sql = `
          INSERT INTO ${quotedTable} (${columns.join(', ')}) 
          VALUES (${placeholders.join(', ')})
        `;

        await this.connection.query(sql, values);
        succeeded++;
      } catch (error) {
        console.error('Failed to insert row:', error.message);
        failed++;
        if (errors.length < 10) { // Keep first 10 errors
          errors.push(error.message);
        }
      }
    }

    return { 
      succeeded, 
      failed, 
      total: this.sourceData.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Upsert data (INSERT or UPDATE if exists)
   * Note: Requires a primary key or unique constraint
   */
  async upsertData() {
    if (!this.sourceSchema) {
      this.sourceSchema = profileSchema(this.sourceData, this.dbType);
    }

    // For now, we'll assume first column is the key
    // In a real implementation, you'd want to configure this
    const keyColumn = this.sourceSchema[0].name;

    const quotedTable = quoteIdentifier(this.tableName, this.dbType);
    let succeeded = 0;
    let failed = 0;

    for (const row of this.sourceData) {
      try {
        const columns = Object.keys(row);
        const values = Object.values(row);
        
        let sql;
        if (this.dbType === 'postgresql') {
          const quotedCols = columns.map(k => quoteIdentifier(k, this.dbType));
          const placeholders = values.map((_, i) => `$${i + 1}`);
          const updateSet = quotedCols
            .filter(col => col !== quoteIdentifier(keyColumn, this.dbType))
            .map((col, i) => `${col} = EXCLUDED.${col}`)
            .join(', ');
          
          sql = `
            INSERT INTO ${quotedTable} (${quotedCols.join(', ')}) 
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (${quoteIdentifier(keyColumn, this.dbType)}) 
            DO UPDATE SET ${updateSet}
          `;
        } else if (this.dbType === 'mysql') {
          const quotedCols = columns.map(k => quoteIdentifier(k, this.dbType));
          const placeholders = values.map(() => '?');
          const updateSet = quotedCols
            .filter(col => col !== quoteIdentifier(keyColumn, this.dbType))
            .map(col => `${col} = VALUES(${col})`)
            .join(', ');
          
          sql = `
            INSERT INTO ${quotedTable} (${quotedCols.join(', ')}) 
            VALUES (${placeholders.join(', ')})
            ON DUPLICATE KEY UPDATE ${updateSet}
          `;
        } else {
          throw new Error('Upsert not yet implemented for Oracle');
        }

        await this.connection.query(sql, values);
        succeeded++;
      } catch (error) {
        console.error('Failed to upsert row:', error.message);
        failed++;
      }
    }

    return { succeeded, failed, total: this.sourceData.length };
  }
}

module.exports = { StrategyExecutor };
