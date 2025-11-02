// File: lib/connectors/salesforce.js

const jsforce = require('jsforce');

/**
 * Salesforce Connector
 * Supports both SOQL queries and object-based access
 */

/**
 * Test Salesforce connection
 */
async function testConnection(config) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  try {
    const userInfo = await conn.login(config.username, config.password + (config.securityToken || ''));
    
    return {
      success: true,
      message: 'Salesforce connection successful',
      organizationId: userInfo.organizationId,
      userId: userInfo.id,
      dbType: 'Salesforce'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: {
        errorCode: error.errorCode,
        name: error.name
      }
    };
  }
}

/**
 * Extract data from Salesforce using SOQL
 */
async function extractDataSOQL(config, soqlQuery) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  try {
    const records = [];
    const result = await conn.query(soqlQuery);
    
    // Handle pagination
    let fetchedRecords = result.records;
    records.push(...fetchedRecords);
    
    // Fetch remaining records if query is not done
    let nextRecordsUrl = !result.done ? result.nextRecordsUrl : null;
    while (nextRecordsUrl) {
      const moreResult = await conn.queryMore(nextRecordsUrl);
      records.push(...moreResult.records);
      nextRecordsUrl = !moreResult.done ? moreResult.nextRecordsUrl : null;
    }

    // Remove Salesforce metadata attributes
    return records.map(record => {
      const clean = { ...record };
      delete clean.attributes;
      return clean;
    });
  } finally {
    await conn.logout();
  }
}

/**
 * Extract data from Salesforce using Object API
 */
async function extractDataObject(config, objectName, fields = null, whereClause = null) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  try {
    // If no fields specified, describe object and get all fields
    if (!fields) {
      const describe = await conn.sobject(objectName).describe();
      fields = describe.fields
        .filter(f => f.type !== 'address' && f.type !== 'location') // Skip complex types
        .map(f => f.name);
    }

    // Build SOQL query
    let soql = `SELECT ${fields.join(', ')} FROM ${objectName}`;
    if (whereClause) {
      soql += ` WHERE ${whereClause}`;
    }

    return await extractDataSOQL(config, soql);
  } finally {
    await conn.logout();
  }
}

/**
 * Load data to Salesforce (insert/update)
 */
async function loadDataToSalesforce(config, objectName, data, operation = 'insert') {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  try {
    let results;
    
    if (operation === 'insert') {
      results = await conn.sobject(objectName).create(data);
    } else if (operation === 'update') {
      results = await conn.sobject(objectName).update(data);
    } else if (operation === 'upsert') {
      const externalIdField = config.externalIdField || 'Id';
      results = await conn.sobject(objectName).upsert(data, externalIdField);
    } else {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    // Process results
    const succeeded = Array.isArray(results) 
      ? results.filter(r => r.success).length 
      : (results.success ? 1 : 0);
    
    const failed = Array.isArray(results)
      ? results.filter(r => !r.success).length
      : (results.success ? 0 : 1);

    return { succeeded, failed, total: data.length, results };
  } finally {
    await conn.logout();
  }
}

/**
 * Get Salesforce connection (for strategy executor)
 */
async function getConnection(config) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  return {
    query: async (soql) => {
      const result = await conn.query(soql);
      const records = result.records.map(record => {
        const clean = { ...record };
        delete clean.attributes;
        return clean;
      });
      return { rows: records };
    },
    insert: async (objectName, data) => {
      return await loadDataToSalesforce(config, objectName, data, 'insert');
    },
    update: async (objectName, data) => {
      return await loadDataToSalesforce(config, objectName, data, 'update');
    },
    upsert: async (objectName, data, externalIdField = 'Id') => {
      config.externalIdField = externalIdField;
      return await loadDataToSalesforce(config, objectName, data, 'upsert');
    },
    _connection: conn
  };
}

/**
 * Close Salesforce connection
 */
async function closeConnection(conn) {
  if (conn._connection) {
    await conn._connection.logout();
  }
}

/**
 * List available Salesforce objects
 */
async function listObjects(config) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  try {
    const describe = await conn.describeGlobal();
    return describe.sobjects.map(obj => ({
      name: obj.name,
      label: obj.label,
      custom: obj.custom,
      queryable: obj.queryable,
      updateable: obj.updateable,
      createable: obj.createable
    }));
  } finally {
    await conn.logout();
  }
}

/**
 * Describe a Salesforce object (get fields)
 */
async function describeObject(config, objectName) {
  const conn = new jsforce.Connection({
    loginUrl: config.loginUrl || 'https://login.salesforce.com',
    version: config.apiVersion || '58.0'
  });

  await conn.login(config.username, config.password + (config.securityToken || ''));

  try {
    const describe = await conn.sobject(objectName).describe();
    return {
      name: describe.name,
      label: describe.label,
      fields: describe.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        length: f.length,
        precision: f.precision,
        scale: f.scale,
        required: !f.nillable,
        updateable: f.updateable,
        createable: f.createable
      }))
    };
  } finally {
    await conn.logout();
  }
}

module.exports = {
  testConnection,
  extractDataSOQL,
  extractDataObject,
  loadDataToSalesforce,
  getConnection,
  closeConnection,
  listObjects,
  describeObject
};
