// File: /lib/connectors/servicenow.js
// ServiceNow Table API Connector

const axios = require('axios');

/**
 * Test ServiceNow connection
 */
async function testConnection(config) {
  try {
    const { instance, username, password } = config;

    if (!instance || !username || !password) {
      return {
        success: false,
        error: 'Missing required configuration: instance, username, and password are required'
      };
    }

    // Test connection by querying sys_user table (should always exist)
    const url = `https://${instance}.service-now.com/api/now/table/sys_user?sysparm_limit=1`;

    const response = await axios.get(url, {
      auth: {
        username: username,
        password: password,
      },
      headers: {
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return {
      success: true,
      message: 'ServiceNow connection successful',
      instance: instance,
      statusCode: response.status,
    };
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      return {
        success: false,
        error: `Authentication failed: ${error.response.status} ${error.response.statusText}`,
        details: {
          status: error.response.status,
          statusText: error.response.statusText,
        }
      };
    } else if (error.request) {
      // Request made but no response
      return {
        success: false,
        error: 'Cannot reach ServiceNow instance. Check instance name and network connection.',
        details: {
          message: error.message,
        }
      };
    } else {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Query ServiceNow table
 */
async function query(config, tableName, queryParams = {}) {
  try {
    const { instance, username, password } = config;

    // Build query string
    const params = new URLSearchParams(queryParams);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const url = `https://${instance}.service-now.com/api/now/table/${tableName}${queryString}`;

    const response = await axios.get(url, {
      auth: {
        username: username,
        password: password,
      },
      headers: {
        'Accept': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data.result || [],
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

/**
 * Insert record into ServiceNow table
 */
async function insert(config, tableName, data) {
  try {
    const { instance, username, password } = config;

    const url = `https://${instance}.service-now.com/api/now/table/${tableName}`;

    const response = await axios.post(url, data, {
      auth: {
        username: username,
        password: password,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data.result,
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

/**
 * Update record in ServiceNow table
 */
async function update(config, tableName, sysId, data) {
  try {
    const { instance, username, password } = config;

    const url = `https://${instance}.service-now.com/api/now/table/${tableName}/${sysId}`;

    const response = await axios.put(url, data, {
      auth: {
        username: username,
        password: password,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data.result,
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

module.exports = {
  testConnection,
  query,
  insert,
  update,
};