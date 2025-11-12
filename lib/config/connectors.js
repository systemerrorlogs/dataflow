// File: lib/config/connectors.js

/**
 * Connector feature flags
 * Set to false to disable a connector in the UI
 */
const ENABLED_CONNECTORS = {
  postgresql: true,
  mysql: true,
  oracle: true,
  sqlserver: true,
  vertica: true,
  cockroachdb: true,
  salesforce: true,
  servicenow: true,
  excel: true,
  csv: true
};

/**
 * Get list of enabled connector types
 */
export function getEnabledConnectors() {
  return Object.entries(ENABLED_CONNECTORS)
    .filter(([_, enabled]) => enabled)
    .map(([type, _]) => type);
}

/**
 * Check if a connector type is enabled
 */
export function isConnectorEnabled(type) {
  return ENABLED_CONNECTORS[type] === true;
}

/**
 * Get all connector metadata
 */
export function getConnectorMetadata() {
  return {
    postgresql: { name: 'PostgreSQL', icon: '🐘', category: 'database' },
    mysql: { name: 'MySQL', icon: '🐬', category: 'database' },
    oracle: { name: 'Oracle', icon: '🔶', category: 'database' },
    sqlserver: { name: 'SQL Server', icon: '🔷', category: 'database' },
    vertica: { name: 'Vertica', icon: '📊', category: 'database' },
    cockroachdb: { name: 'CockroachDB', icon: '🦗', category: 'database' },
    salesforce: { name: 'Salesforce', icon: '☁️', category: 'cloud' },
    servicenow: { name: 'ServiceNow', icon: '🎫', category: 'cloud' },
    excel: { name: 'Excel', icon: '📊', category: 'file' },
    csv: { name: 'CSV', icon: '📄', category: 'file' }
  };
}

export default ENABLED_CONNECTORS;