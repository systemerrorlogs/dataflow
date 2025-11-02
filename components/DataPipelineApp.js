'use client';
import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { Home, Database, Search, FileText, Plus, RefreshCw, Menu, X, User, Users, LogOut, CheckCircle, XCircle, Clock, PlayCircle, Settings, ChevronDown, BookOpen, HelpCircle } from 'lucide-react';
import LogsModal from './LogsModal';
import ExecutionHistoryModal from './ExecutionHistoryModal';
import { useSession } from 'next-auth/react';
import { getEnabledConnectors, getConnectorMetadata, isConnectorEnabled } from '@/lib/config/connectors';

const TeamContext = createContext();

const api = {
  async call(endpoint, options = {}) {
      const teamId = localStorage.getItem('currentTeamId');

      // ✅ CRITICAL FIX: Validate teamId before making API call
      if (!teamId || teamId === 'null' || teamId === 'undefined') {
        throw new Error('No team selected. Please select a team first.');
      }

      const teamIdInt = parseInt(teamId, 10);
      if (isNaN(teamIdInt)) {
        throw new Error('Invalid team ID');
      }

      const res = await fetch(`/api/teams/${teamIdInt}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'API call failed');
      }
      return res.json();
    },

  teams: {
    list: () => fetch('/api/teams').then(r => r.json()),
  },

  connections: {
    list: () => api.call('/connections'),
    create: (data) => api.call('/connections', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.call(`/connections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => api.call(`/connections/${id}`, { method: 'DELETE' }),
    test: (id) => api.call(`/connections/${id}/test`, { method: 'POST' }),
  },

  tasks: {
    list: () => api.call('/tasks'),
    get: (id) => api.call(`/tasks/${id}`),
    create: (data) => api.call('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.call(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    execute: (id) => api.call(`/tasks/${id}/execute`, { method: 'POST' }),
    executions: (id) => api.call(`/tasks/${id}/executions`),
  },

  query: {
    execute: (data) => api.call('/query', { method: 'POST', body: JSON.stringify(data) }),
  },

  dashboard: {
    stats: () => api.call('/dashboard'),
  },
};

const Sidebar = ({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }) => {
  const { currentTeam, currentUser } = useContext(TeamContext);


  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'connections', label: 'Connections', icon: Database },
    { id: 'query', label: 'Data Explorer', icon: Search },
    { id: 'tasks', label: 'Tasks', icon: FileText },
    { id: 'documentation', label: 'Documentation', icon: BookOpen },
    ...(currentUser?.is_admin ? [{ id: 'admin', label: 'Admin', icon: Settings }] : [])
  ];


  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-400" />
              <span className="font-bold text-lg">DataFlow</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {currentTeam && (
            <div className="p-4 border-t border-gray-800 text-sm text-gray-400">
              <div className="font-medium text-white">{currentTeam.name}</div>
              <div className="text-xs">Role: {currentTeam.role}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const TopBar = ({ setSidebarOpen, userTeams, currentUser }) => {
  const { currentTeam, setCurrentTeam } = useContext(TeamContext);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    // Clear localStorage
    localStorage.clear();

    // Sign out without confirmation page
    window.location.href = '/api/auth/signout?callbackUrl=/login';
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu size={24} />
          </button>

          <div className="relative">
            <button
              onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium">{currentTeam?.name || 'Select Team'}</span>
              <ChevronDown size={16} />
            </button>

            {teamDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  {userTeams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setCurrentTeam(team);
                        localStorage.setItem('currentTeamId', team.id);
                        setTeamDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                        currentTeam?.id === team.id ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      <div className="font-medium">{team.name}</div>
                      <div className="text-xs text-gray-500">Role: {team.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg"
          >
            <User size={20} />
            <span className="hidden md:inline">{currentUser?.name || 'User'}</span>
          </button>

          {userDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-gray-200">
                <div className="font-medium">{currentUser?.name || 'User'}</div>
                <div className="text-sm text-gray-500">{currentUser?.email || 'user@example.com'}</div>
              </div>
              <div className="p-2">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 rounded"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { currentTeam } = useContext(TeamContext); // ✅ Get currentTeam from context
  const [stats, setStats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    taskId: null,
    taskName: ''
  });
  const [monitoringExecution, setMonitoringExecution] = useState(null);

  // ✅ Load dashboard when currentTeam changes
  useEffect(() => {
    if (currentTeam) {
      loadDashboard();
    }
  }, [currentTeam]); // Re-run when team changes

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashData, tasksData] = await Promise.all([
        api.dashboard.stats(),
        api.tasks.list()
      ]);
      setStats(dashData.stats);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleViewLogs = (task) => {
    setHistoryModal({
      isOpen: true,
      taskId: task.id,
      taskName: task.name
    });
  };

  const statusCounts = useMemo(() => {
    if (!stats) return { total: 0, success: 0, failed: 0, running: 0 };

    const counts = { total: 0, success: 0, failed: 0, running: 0 };
    stats.forEach(stat => {
      counts[stat.status] = parseInt(stat.count);
      counts.total += parseInt(stat.count);
    });
    return counts;
  }, [stats]);

  const filteredTasks = useMemo(() => {
    if (selectedStatus === 'all') return tasks;
    return tasks.filter(t => t.last_status === selectedStatus);
  }, [tasks, selectedStatus]);

  const handleRetryTask = async (taskId) => {
    try {
      const result = await api.tasks.execute(taskId);
      setMonitoringExecution(result.executionId);
      await loadDashboard();
    } catch (error) {
      console.error('Failed to retry task:', error);
      alert('Failed to retry task');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Today: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`p-6 bg-white rounded-lg border-2 transition-all text-left ${
            selectedStatus === 'all' ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-gray-900">{statusCounts.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Tasks</div>
        </button>

        <button
          onClick={() => setSelectedStatus('success')}
          className={`p-6 bg-white rounded-lg border-2 transition-all text-left ${
            selectedStatus === 'success' ? 'border-green-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={24} />
            <div className="text-3xl font-bold text-gray-900">{statusCounts.success}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Success</div>
        </button>

        <button
          onClick={() => setSelectedStatus('failed')}
          className={`p-6 bg-white rounded-lg border-2 transition-all text-left ${
            selectedStatus === 'failed' ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <XCircle className="text-red-600" size={24} />
            <div className="text-3xl font-bold text-gray-900">{statusCounts.failed}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Failed</div>
        </button>

        <button
          onClick={() => setSelectedStatus('running')}
          className={`p-6 bg-white rounded-lg border-2 transition-all text-left ${
            selectedStatus === 'running' ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="text-blue-600" size={24} />
            <div className="text-3xl font-bold text-gray-900">{statusCounts.running}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Running</div>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pipeline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Run</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{task.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{task.source_name}</span>
                      <span>→</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{task.target_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      task.last_status === 'success' ? 'bg-green-100 text-green-800' :
                      task.last_status === 'failed' ? 'bg-red-100 text-red-800' :
                      task.last_status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.last_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{task.last_records || 0}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                          onClick={() => handleViewLogs(task)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Execution History"
                        >
                          <FileText size={16} />
                        </button>
                      <button
                        onClick={() => handleRetryTask(task.id)}
                        className="text-green-600 hover:text-green-800"
                        title="Retry Task"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {monitoringExecution && (
        <ExecutionMonitor
          executionId={monitoringExecution}
          onClose={() => {
            setMonitoringExecution(null);
            loadDashboard();
          }}
        />
      )}
      <ExecutionHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, taskId: null, taskName: '' })}
        taskId={historyModal.taskId}
        taskName={historyModal.taskName}
      />
    </div>
  );
};

const ConnectionsPage = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testingInForm, setTestingInForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    connection_type: 'database',
    can_be_source: true,
    can_be_target: true,
    config: {},
    configPassword: ''
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await api.connections.list();
      setConnections(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (connection) => {
      // Remove password from config before showing in form
      const configWithoutPassword = { ...connection.config };
      const configPassword = configWithoutPassword.password;
      delete configWithoutPassword.password;

      setFormData({
        name: connection.name,
        connection_type: connection.connection_type,
        config: configWithoutPassword,  // Config WITHOUT password
        can_be_source: connection.can_be_source,
        can_be_target: connection.can_be_target,
        configPassword: configPassword
      });
      setEditingConnection(connection);
      setShowForm(true);
    };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;

    try {
      await api.connections.delete(id);
      await loadConnections();
    } catch (error) {
      console.error('Failed to delete connection:', error);
      alert('Failed to delete connection');
    }
  };

  const handleSubmit = async () => {
  try {
    // Merge password into config if provided
    const finalConfig = { ...formData.config };
    if (formData.configPassword) {
      finalConfig.password = formData.configPassword;
    }

    const payload = {
      name: formData.name,
      connection_type: formData.connection_type,
      config: finalConfig,
      can_be_source: formData.can_be_source,
      can_be_target: formData.can_be_target
    };

    if (editingConnection) {
      // Update existing connection - use api.connections.update
      await api.connections.update(editingConnection.id, payload);
    } else {
      // Create new connection - use api.connections.create
      await api.connections.create(payload);
    }

    loadConnections();
    setShowForm(false);
    setEditingConnection(null);
    setFormData({
      name: '',
      connection_type: 'database',
      config: {},
      can_be_source: true,
      can_be_target: false,
      configPassword: ''
    });
  } catch (error) {
    console.error('Failed to save connection:', error);
    alert('Failed to save connection');
  }
};

  const handleTestConnection = async (id) => {
    try {
      setTestingConnection(id);
      const result = await api.connections.test(id);
      if (result.success) {
        alert('✓ Connection test successful!');
      } else {
        alert(`✗ Connection test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      alert(`✗ Connection test failed: ${error.message}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleTestConnectionInForm = async () => {
  // Validate required fields
  if (!formData.name.trim()) {
    alert('Please enter a connection name');
    return;
  }

  if (Object.keys(formData.config).length === 0) {
    alert('Please enter connection configuration');
    return;
  }

  try {
    setTestingInForm(true);

    const currentTeamId = localStorage.getItem('currentTeamId');

    // ✅ Merge password into config for testing
    const configForTest = { ...formData.config };
    if (formData.configPassword) {
      configForTest.password = formData.configPassword;
    }

    // Test the connection using the merged config
    const result = await fetch(`/api/teams/${currentTeamId}/connections/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_type: formData.connection_type,
        config: configForTest  // ✅ Now includes password
      })
    });

    const data = await result.json();

    if (data.success) {
      alert('✓ Connection test successful!\n\n' + data.message);
    } else {
      alert('✗ Connection test failed:\n\n' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Failed to test connection:', error);
    alert('✗ Connection test failed:\n\n' + error.message);
  } finally {
    setTestingInForm(false);
  }
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading connections...</div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {editingConnection ? 'Edit Connection' : 'New Connection'}
          </h1>
          <button
            onClick={() => {
              setShowForm(false);
              setEditingConnection(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="My Database Connection"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Type
            </label>
            <select
              value={formData.connection_type}
              onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="oracle">Oracle</option>
              <option value="mysql">MySQL</option>
              <option value="sqlserver">SQL Server</option>
              <option value="vertica">Vertica</option>
              <option value="cockroachdb">CockroachDB</option>
              <option value="salesforce">Salesforce</option>
              <option value="servicenow">ServiceNow</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.can_be_source}
                onChange={(e) => setFormData({ ...formData, can_be_source: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Can be Source</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.can_be_target}
                onChange={(e) => setFormData({ ...formData, can_be_target: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Can be Target</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration (JSON)
            </label>
            {/* Password Field - Add this entire block ABOVE the Configuration JSON textarea */}
            {(formData.connection_type !== 'csv') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                  <span className="text-xs text-gray-500 ml-2">(This will be encrypted when saved)</span>
                </label>
                <input
                  type="password"
                  value={formData.configPassword}
                  onChange={(e) => setFormData({ ...formData, configPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter password"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the password for this connection. It will not be visible in the configuration below.
                </p>
              </div>
            )}
            <textarea
              value={JSON.stringify(formData.config, null, 2)}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, config: JSON.parse(e.target.value) });
                } catch (err) {
                  // Invalid JSON, don't update
                }
              }}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder='{"host": "localhost", "port": 5432}'
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={handleTestConnectionInForm}
                disabled={testingInForm}
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingInForm ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingConnection ? 'Update' : 'Create'} Connection
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingConnection(null);
                  setFormData({
                    name: '',
                    connection_type: 'postgresql',
                    can_be_source: true,
                    can_be_target: true,
                    config: {}
                  });
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Connection
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map(conn => (
          <div key={conn.id} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{conn.name}</h3>
                <p className="text-sm text-gray-500">{conn.connection_type}</p>
              </div>
              <Database className="text-blue-500" size={24} />
            </div>

            <div className="mt-4 flex gap-2">
              {conn.can_be_source && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Source</span>
              )}
              {conn.can_be_target && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Target</span>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleEdit(conn)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleTestConnection(conn.id)}
                disabled={testingConnection === conn.id}
                className="px-3 py-2 border border-blue-300 text-blue-600 rounded hover:bg-blue-50 text-sm disabled:opacity-50"
              >
                {testingConnection === conn.id ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={() => handleDelete(conn.id)}
                className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QueryToolPage = ({ setCurrentPage, setTaskFormData }) => {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [selectedConnectionType, setSelectedConnectionType] = useState('');
  const [query, setQuery] = useState('');
  const [worksheetName, setWorksheetName] = useState('');
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await api.connections.list();
      setConnections(data.filter(c => c.can_be_source));
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const handleConnectionChange = (e) => {
    const connId = e.target.value;
    setSelectedConnection(connId);
    const conn = connections.find(c => c.id === parseInt(connId));
    setSelectedConnectionType(conn?.connection_type || '');
    setWorksheetName('');
  };

  const handleExecuteQuery = async () => {
    try {
      setLoading(true);
      const result = await api.query.execute({
        connection_id: selectedConnection,
        query_text: query,
        worksheet_name: worksheetName || undefined
      });
      setQueryResults(result);
    } catch (error) {
      console.error('Query execution failed:', error);
      alert(`Query failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    setTaskFormData({
      sourceConnection: parseInt(selectedConnection),
      sourceQuery: query,
      worksheetName: worksheetName || undefined
    });
    setCurrentPage('task-form');
  };

  const isExcelConnection = selectedConnectionType === 'excel';
  const canExecute = selectedConnection && query && (!isExcelConnection || worksheetName);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Explorer</h1>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source Connection
          </label>
          <select
            value={selectedConnection}
            onChange={handleConnectionChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select a connection...</option>
            {connections.map(conn => (
              <option key={conn.id} value={conn.id}>{conn.name} ({conn.connection_type})</option>
            ))}
          </select>
        </div>

        {isExcelConnection && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Worksheet Name *
            </label>
            <input
              type="text"
              value={worksheetName}
              onChange={(e) => setWorksheetName(e.target.value)}
              placeholder="Sheet1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Required for Excel connections</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Query / Path
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isExcelConnection ? "/path/to/file.xlsx" : "SELECT * FROM customers WHERE created_at > '2025-01-01'"}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExecuteQuery}
            disabled={!canExecute || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            <PlayCircle size={20} />
            {loading ? 'Executing...' : 'Execute Query'}
          </button>

          {queryResults?.success && (
            <button
              onClick={handleCreateTask}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus size={20} />
              Create Task from Query
            </button>
          )}
        </div>
      </div>

      {queryResults && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {queryResults.success ? (
            <>
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="text-sm text-gray-600">
                  {queryResults.rowCount} rows returned in {queryResults.executionTime}ms
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {queryResults.columns.map((col, i) => (
                        <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {queryResults.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {queryResults.columns.map((col, j) => (
                            <td key={j} className="px-6 py-4 text-sm text-gray-900">
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-6 text-red-600">
              Error: {queryResults.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TasksPage = ({ setCurrentPage, setTaskFormData }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsModal, setLogsModal] = useState({
    isOpen: false,
    executionId: null,
    taskName: ''
  });

  useEffect(() => {
    loadTasks();
  }, []);

  // Handler for running a task with logs modal
  const handleRunTask = async (task) => {
    try {
      const response = await api.tasks.execute(task.id);

      // Open logs modal with the new execution ID
      setLogsModal({
        isOpen: true,
        executionId: response.execution_id,
        taskName: task.name
      });

      // Refresh tasks list after a delay
      setTimeout(loadTasks, 3000);

    } catch (error) {
      alert('Failed to run task: ' + error.message);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.tasks.list();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTask = (taskId) => {
      setTaskFormData({ taskId: taskId });
      setCurrentPage('task-form');
    };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => setCurrentPage('task-form')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Create Task
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Run</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{task.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{task.source_name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{task.target_name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.last_status === 'success' ? 'bg-green-100 text-green-800' :
                      task.last_status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.last_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                          onClick={() => handleEditTask(task.id)}
                          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-xs"
                        >
                          Edit
                        </button>
                      <button
                        onClick={() => handleRunTask(task)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                      >
                        Run
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <LogsModal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal({ isOpen: false, executionId: null, taskName: '' })}
        executionId={logsModal.executionId}
        taskName={logsModal.taskName}
      />
    </div>
  );
};

const TaskFormPage = ({ taskFormData, setCurrentPage, editingTask }) => {
  const [connections, setConnections] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceConnection, setSourceConnection] = useState(taskFormData?.sourceConnection || '');
  const [targetConnection, setTargetConnection] = useState('');
  const [sourceQuery, setSourceQuery] = useState(taskFormData?.sourceQuery || '');
  const [sourceWorksheet, setSourceWorksheet] = useState(taskFormData?.worksheetName || '');
  const [targetTable, setTargetTable] = useState('');
  const [targetWorksheet, setTargetWorksheet] = useState('');
  const [strategies, setStrategies] = useState(['check_exists', 'create_table', 'append_data']);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Available strategies with descriptions
  const availableStrategies = [
    {
      value: 'check_exists',
      label: 'Check Table Exists',
      icon: '🔍',
      description: 'Check if target table exists in database'
    },
    {
      value: 'create_table',
      label: 'Create Table',
      icon: '🆕',
      description: 'Create table based on source data schema'
    },
    {
      value: 'drop_table',
      label: 'Drop Table',
      icon: '🗑️',
      description: 'Drop existing table completely'
    },
    {
      value: 'truncate_table',
      label: 'Truncate Table',
      icon: '🧹',
      description: 'Delete all rows, keep table structure'
    },
    {
      value: 'alter_add_columns',
      label: 'Add Missing Columns',
      icon: '➕',
      description: 'Add new columns from source to target'
    },
    {
      value: 'append_data',
      label: 'Append Data',
      icon: '📥',
      description: 'Insert data into table'
    },
    {
      value: 'upsert_data',
      label: 'Upsert Data',
      icon: '🔄',
      description: 'Insert or update based on primary key'
    }
  ];

  // Common strategy presets
  const strategyPresets = [
    {
      name: 'Safe Default',
      icon: '📋',
      strategies: ['check_exists', 'create_table', 'append_data'],
      description: 'Create table if needed, then load data'
    },
    {
      name: 'Full Refresh',
      icon: '🔄',
      strategies: ['truncate_table', 'append_data'],
      description: 'Empty table and load fresh data'
    },
    {
      name: 'Rebuild',
      icon: '🆕',
      strategies: ['drop_table', 'create_table', 'append_data'],
      description: 'Drop and recreate table from scratch'
    },
    {
      name: 'Evolve & Refresh',
      icon: '🔧',
      strategies: ['check_exists', 'alter_add_columns', 'truncate_table', 'append_data'],
      description: 'Add new columns, then refresh all data'
    },
    {
      name: 'Incremental',
      icon: '➕',
      strategies: ['check_exists', 'create_table', 'alter_add_columns', 'append_data'],
      description: 'Add columns and append new data'
    }
  ];

  useEffect(() => {
    loadConnections();
    if (editingTask) {
      loadTaskData(editingTask);
    }
  }, [editingTask]);

  const loadConnections = async () => {
    try {
      const data = await api.connections.list();
      setConnections(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const loadTaskData = async (taskId) => {
    try {
      setLoading(true);
      setIsEditMode(true);
      const task = await api.tasks.get(taskId);

      setName(task.name);
      setDescription(task.description || '');
      setSourceConnection(task.source_connection_id);
      setTargetConnection(task.target_connection_id);
      setSourceQuery(task.source_query || '');
      setSourceWorksheet(task.source_worksheet || '');
      setTargetTable(task.target_table || '');
      setTargetWorksheet(task.target_worksheet || '');

      // Parse loading strategies
      if (task.loading_strategies) {
        const parsedStrategies = typeof task.loading_strategies === 'string'
          ? JSON.parse(task.loading_strategies)
          : task.loading_strategies;
        setStrategies(parsedStrategies);
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      alert('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const sourceConnections = connections.filter(c => c.can_be_source);
  const targetConnections = connections.filter(c => c.can_be_target);

  const sourceConn = connections.find(c => c.id === parseInt(sourceConnection));
  const targetConn = connections.find(c => c.id === parseInt(targetConnection));

  const isSourceExcel = sourceConn?.connection_type === 'excel';
  const isTargetExcel = targetConn?.connection_type === 'excel';
  const isTargetDatabase = ['postgresql', 'mysql', 'oracle'].includes(targetConn?.connection_type);

  const handleSubmit = async () => {
    // Validation
    if (!name || !sourceConnection || !targetConnection || !sourceQuery || !targetTable) {
      alert('Please fill in all required fields');
      return;
    }

    if (isSourceExcel && !sourceWorksheet) {
      alert('Worksheet name is required for Excel source connections');
      return;
    }

    if (isTargetExcel && !targetWorksheet) {
      alert('Worksheet name is required for Excel target connections');
      return;
    }

    if (isTargetDatabase && strategies.length === 0) {
      alert('Please select at least one loading strategy');
      return;
    }

    try {
      setLoading(true);

      const taskData = {
        name,
        description,
        source_connection_id: parseInt(sourceConnection),
        target_connection_id: parseInt(targetConnection),
        source_query: sourceQuery,
        source_worksheet: sourceWorksheet || undefined,
        target_table: targetTable,
        target_worksheet: targetWorksheet || undefined,
        loading_strategies: isTargetDatabase ? strategies : null
      };

      if (isEditMode) {
        await api.tasks.update(editingTask, taskData);
        alert('Task updated successfully!');
      } else {
        await api.tasks.create(taskData);
        alert('Task created successfully!');
      }

      setCurrentPage('tasks');
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('Failed to save task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeStrategy = (index) => {
    const newStrategies = strategies.filter((_, i) => i !== index);
    setStrategies(newStrategies);
  };

  const moveStrategy = (index, direction) => {
    const newStrategies = [...strategies];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex >= 0 && swapIndex < newStrategies.length) {
      [newStrategies[index], newStrategies[swapIndex]] =
      [newStrategies[swapIndex], newStrategies[index]];
      setStrategies(newStrategies);
    }
  };

  const addStrategy = (strategyValue) => {
    if (strategyValue && !strategies.includes(strategyValue)) {
      setStrategies([...strategies, strategyValue]);
    }
  };

  const applyPreset = (preset) => {
    setStrategies([...preset.strategies]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditMode ? 'Edit Task' : 'Create New Task'}
        </h2>

        {/* Basic Info */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Data Pipeline"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* Source & Target Configuration */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Source Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Source</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Connection *
              </label>
              <select
                value={sourceConnection}
                onChange={(e) => setSourceConnection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select source...</option>
                {sourceConnections.map(conn => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.connection_type})
                  </option>
                ))}
              </select>
            </div>

            {isSourceExcel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Worksheet Name *
                </label>
                <input
                  type="text"
                  value={sourceWorksheet}
                  onChange={(e) => setSourceWorksheet(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Query *
              </label>
              <textarea
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="SELECT * FROM table"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>

          {/* Target Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Target</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Connection *
              </label>
              <select
                value={targetConnection}
                onChange={(e) => setTargetConnection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select target...</option>
                {targetConnections.map(conn => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.connection_type})
                  </option>
                ))}
              </select>
            </div>

            {isTargetExcel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Worksheet Name *
                </label>
                <input
                  type="text"
                  value={targetWorksheet}
                  onChange={(e) => setTargetWorksheet(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isTargetExcel ? 'File Path *' : 'Target Table *'}
              </label>
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder={isTargetExcel ? "/path/to/output.xlsx" : "target_table"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Loading Strategy Pipeline - Only for database targets */}
        {isTargetDatabase && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Loading Strategy Pipeline
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select and order the strategies that will execute when this task runs
            </p>

            {/* Strategy Presets */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Presets:
              </label>
              <div className="flex gap-2 flex-wrap">
                {strategyPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title={preset.description}
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Pipeline */}
            <div className="space-y-2 mb-3">
              {strategies.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No strategies selected. Add strategies below.
                </div>
              ) : (
                strategies.map((strategy, index) => {
                  const strategyInfo = availableStrategies.find(s => s.value === strategy);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <span className="text-xl flex-shrink-0">{strategyInfo?.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {index + 1}. {strategyInfo?.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {strategyInfo?.description}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {index > 0 && (
                          <button
                            onClick={() => moveStrategy(index, 'up')}
                            className="p-1 text-gray-600 hover:text-gray-900"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {index < strategies.length - 1 && (
                          <button
                            onClick={() => moveStrategy(index, 'down')}
                            className="p-1 text-gray-600 hover:text-gray-900"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => removeStrategy(index)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Strategy Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Strategy:
              </label>
              <select
                onChange={(e) => {
                  addStrategy(e.target.value);
                  e.target.value = '';
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">+ Select strategy to add...</option>
                {availableStrategies.map(s => (
                  <option
                    key={s.value}
                    value={s.value}
                    disabled={strategies.includes(s.value)}
                  >
                    {s.icon} {s.label} - {s.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Task' : 'Create Task')}
          </button>
          <button
            onClick={() => setCurrentPage('tasks')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};


// Complete DocumentationPage Component
// Replace your existing DocumentationPage in DataPipelineApp.js with this

const DocumentationPage = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: BookOpen },
    { id: 'getting-started', title: 'Getting Started', icon: PlayCircle },
    { id: 'connections', title: 'Managing Connections', icon: Database },
    { id: 'query-tool', title: 'Query Tool', icon: Search },
    { id: 'tasks', title: 'Creating Tasks', icon: FileText },
    { id: 'execution-logs', title: 'Viewing Execution Logs', icon: FileText },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: XCircle },
    { id: 'teams', title: 'Team Management', icon: User },
    { id: 'faq', title: 'FAQ', icon: HelpCircle }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Welcome to DataFlow</h2>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-blue-900 font-medium">
                DataFlow is a powerful data pipeline management platform that helps you move data between systems quickly and reliably.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">What Can You Do?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">Connect to Data Sources</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Set up connections to databases (PostgreSQL, Oracle, MySQL), file systems (SFTP), and files (Excel, CSV).
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-gray-900">Test & Explore Data</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Use the Query Tool to run SQL queries, preview data, and verify connections before creating tasks.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-gray-900">Create Data Tasks</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Build tasks that automatically move data from source to target on a schedule or on-demand.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-teal-600" />
                    <h4 className="font-semibold text-gray-900">Monitor Executions</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Track task runs in real-time, view logs, review execution history, and troubleshoot issues.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-900">Key Features</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><strong>Multiple Data Sources:</strong> PostgreSQL, Oracle, MySQL, SFTP, Excel, CSV</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><strong>Real-Time Monitoring:</strong> View live logs as tasks execute</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><strong>Execution History:</strong> Review past runs, check status, and debug failures</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><strong>Team Collaboration:</strong> Share connections and tasks within your team</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><strong>Scheduled Tasks:</strong> Run data pipelines automatically on a schedule</span>
                </li>
              </ul>
            </div>
          </div>
        );

      case 'getting-started':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Getting Started</h2>

            <p className="text-lg text-gray-700">
              Follow these steps to create your first data pipeline in DataFlow.
            </p>

            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 1: Create Connections</h3>
              <p className="text-gray-700 mb-3">
                Before moving data, you need to set up connections to your data sources and targets.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">To create a connection:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Click <strong>Connections</strong> in the sidebar</li>
                  <li>Click the <strong>+ Add Connection</strong> button</li>
                  <li>Fill in the connection details</li>
                  <li>Click <strong>Test Connection</strong> to verify it works</li>
                  <li>Click <strong>Save</strong> once the test passes</li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Tip:</strong> Create at least TWO connections - one source and one target - before creating tasks.
                </p>
              </div>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 2: Test Your Connection</h3>
              <p className="text-gray-700 mb-3">
                Use the Query Tool to verify your connection and explore your data.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">To test a connection:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Click <strong>Query Tool</strong> in the sidebar</li>
                  <li>Select a connection from the dropdown</li>
                  <li>Enter a test query</li>
                  <li>Click <strong>Execute Query</strong></li>
                  <li>Review the results in the table below</li>
                </ol>
              </div>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 3: Create Your First Task</h3>
              <p className="text-gray-700 mb-3">
                Now that your connections are ready, create a task to move data.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">To create a task:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Click <strong>Tasks</strong> in the sidebar</li>
                  <li>Click <strong>+ Create Task</strong></li>
                  <li>Fill in the task details</li>
                  <li>Enable <strong>"Capture Logs"</strong> to track execution history</li>
                  <li>Click <strong>Create Task</strong></li>
                </ol>
              </div>
            </div>

            <div className="border-l-4 border-teal-500 pl-4 py-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 4: Run and Monitor Your Task</h3>
              <p className="text-gray-700 mb-3">
                Execute your task and watch it in real-time.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">To run a task:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Find your task in the <strong>Tasks</strong> page</li>
                  <li>Click the <strong>▶ Run</strong> button</li>
                  <li>A logs modal will open automatically showing real-time logs</li>
                  <li>Watch the logs update as the task executes</li>
                  <li>The modal will show final status when complete</li>
                </ol>
              </div>
            </div>

            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 5: Review Execution History</h3>
              <p className="text-gray-700 mb-3">
                Check past runs and troubleshoot any issues.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">To view execution history:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Go to the <strong>Dashboard</strong></li>
                  <li>Find the task in your recent executions</li>
                  <li>Click the <strong>Logs</strong> button on any task card</li>
                  <li>View all past executions</li>
                  <li>Click <strong>View Logs</strong> on any execution to see its detailed logs</li>
                </ol>
              </div>
            </div>

            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mt-6">
              <h3 className="font-semibold text-blue-900 mb-2">🎉 You're All Set!</h3>
              <p className="text-blue-900 text-sm">
                You've now created your first data pipeline! Continue exploring the other features or check out the FAQ section for common questions.
              </p>
            </div>
          </div>
        );

      case 'execution-logs':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Viewing Execution Logs</h2>

            <p className="text-gray-700">
              DataFlow provides comprehensive logging and monitoring for all task executions.
            </p>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Real-Time Logs</h3>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-3">When you click "Run" on a task:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>A logs modal opens automatically</li>
                  <li>You'll see "Running..." status at the top</li>
                  <li>Logs appear in real-time as the task executes</li>
                  <li>The view auto-scrolls to show the latest logs</li>
                  <li>When complete, you'll see final status</li>
                </ol>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Log Colors Explained</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm"><strong>Red:</strong> Error messages</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm"><strong>Yellow:</strong> Warning messages</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm"><strong>Blue:</strong> Info messages</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm"><strong>Green:</strong> Success messages</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Historical Logs</h3>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-3">To view logs from previous runs:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Go to the <strong>Dashboard</strong></li>
                  <li>Find the task you want to review</li>
                  <li>Click the <strong>Logs</strong> button on the task card</li>
                  <li>You'll see a table of all past executions</li>
                  <li>Click <strong>View Logs</strong> on any row to see its complete logs</li>
                </ol>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">⚠️ No Logs Available?</h4>
              <p className="text-sm text-yellow-800 mb-2">
                If you don't see logs for a task execution:
              </p>
              <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm ml-4">
                <li>The task may have "Capture Logs" disabled - Edit the task and enable this option</li>
                <li>The task hasn't been run yet - Try running it first</li>
              </ul>
            </div>
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Troubleshooting Guide</h2>

            <p className="text-gray-700">
              Common issues and how to resolve them.
            </p>

            <div className="space-y-4">
              <div className="border-l-4 border-red-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Connection Test Fails</h3>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">Common solutions:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Verify username and password are correct</li>
                    <li>Check host/IP address and port number</li>
                    <li>Confirm firewall allows connections</li>
                    <li>Check database is running and accessible</li>
                  </ul>
                </div>
              </div>

              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Task Execution Fails</h3>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">Steps to debug:</p>
                  <ol className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
                    <li>Click "View Logs" on the failed execution</li>
                    <li>Look for red error messages</li>
                    <li>Check table names and column names are correct</li>
                    <li>Verify user has required permissions</li>
                    <li>Test connections individually</li>
                  </ol>
                </div>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No Logs Appearing</h3>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">Solution:</p>
                  <ol className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
                    <li>Go to Tasks page and click "Edit" on the task</li>
                    <li>Check the "Capture Logs" checkbox</li>
                    <li>Save the task</li>
                    <li>Run it again and logs should appear</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">💬 Still Need Help?</h3>
              <p className="text-blue-800 text-sm">
                If you're still experiencing issues, contact your system administrator with the error message and steps you took.
              </p>
            </div>
          </div>
        );

      case 'connections':
          return (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Managing Connections</h2>

              <p className="text-gray-700">
                Learn how to configure each type of connection in DataFlow.
              </p>

              {/* Database Connections */}
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Database Connections</h3>

                <p className="text-gray-700 mb-3">
                  Connect to PostgreSQL, Oracle, MySQL, and other SQL databases.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">PostgreSQL Configuration</h4>
                    <div className="bg-white border border-gray-200 rounded p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Required Fields:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                        <li><strong>host:</strong> Server hostname or IP (e.g., "localhost" or "db.example.com")</li>
                        <li><strong>port:</strong> PostgreSQL port (default: 5432)</li>
                        <li><strong>database:</strong> Database name</li>
                        <li><strong>user:</strong> Username for authentication</li>
                        <li><strong>Password:</strong> Use the password field above the configuration (not in JSON)</li>
                      </ul>
                      <div className="mt-3 bg-gray-50 p-2 rounded">
                        <p className="text-xs font-mono text-gray-800">
                          {`{`}<br/>
                          &nbsp;&nbsp;"host": "localhost",<br/>
                          &nbsp;&nbsp;"port": 5432,<br/>
                          &nbsp;&nbsp;"database": "mydb",<br/>
                          &nbsp;&nbsp;"user": "postgres"<br/>
                          {`}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Oracle Configuration</h4>
                    <div className="bg-white border border-gray-200 rounded p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Required Fields:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                        <li><strong>host:</strong> Server hostname or IP</li>
                        <li><strong>port:</strong> Oracle listener port (default: 1521)</li>
                        <li><strong>serviceName:</strong> Oracle service name (e.g., "ORCL")</li>
                        <li><strong>user:</strong> Username for authentication</li>
                        <li><strong>Password:</strong> Use the password field above the configuration</li>
                      </ul>
                      <div className="mt-3 bg-gray-50 p-2 rounded">
                        <p className="text-xs font-mono text-gray-800">
                          {`{`}<br/>
                          &nbsp;&nbsp;"host": "oracle.example.com",<br/>
                          &nbsp;&nbsp;"port": 1521,<br/>
                          &nbsp;&nbsp;"serviceName": "ORCL",<br/>
                          &nbsp;&nbsp;"user": "admin"<br/>
                          {`}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">MySQL Configuration</h4>
                    <div className="bg-white border border-gray-200 rounded p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Required Fields:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                        <li><strong>host:</strong> Server hostname or IP</li>
                        <li><strong>port:</strong> MySQL port (default: 3306)</li>
                        <li><strong>database:</strong> Database name</li>
                        <li><strong>user:</strong> Username for authentication</li>
                        <li><strong>Password:</strong> Use the password field above the configuration</li>
                      </ul>
                      <div className="mt-3 bg-gray-50 p-2 rounded">
                        <p className="text-xs font-mono text-gray-800">
                          {`{`}<br/>
                          &nbsp;&nbsp;"host": "mysql.example.com",<br/>
                          &nbsp;&nbsp;"port": 3306,<br/>
                          &nbsp;&nbsp;"database": "production",<br/>
                          &nbsp;&nbsp;"user": "root"<br/>
                          {`}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SFTP Connections */}
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">SFTP Connections</h3>

                <p className="text-gray-700 mb-3">
                  Connect to SFTP servers for file transfer operations.
                </p>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Required Fields:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                      <li><strong>host:</strong> SFTP server hostname or IP</li>
                      <li><strong>port:</strong> SFTP port (default: 22)</li>
                      <li><strong>username:</strong> Username for authentication</li>
                      <li><strong>Password:</strong> Use the password field above the configuration</li>
                      <li><strong>basePath:</strong> (Optional) Default directory path</li>
                    </ul>
                    <div className="mt-3 bg-gray-50 p-2 rounded">
                      <p className="text-xs font-mono text-gray-800">
                        {`{`}<br/>
                        &nbsp;&nbsp;"host": "sftp.example.com",<br/>
                        &nbsp;&nbsp;"port": 22,<br/>
                        &nbsp;&nbsp;"username": "sftpuser",<br/>
                        &nbsp;&nbsp;"basePath": "/uploads"<br/>
                        {`}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Connections */}
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">File Connections (CSV/Excel)</h3>

                <p className="text-gray-700 mb-3">
                  Connect to file storage for CSV and Excel file operations.
                </p>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Required Fields:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                      <li><strong>filePath:</strong> Full path to the file or directory</li>
                      <li><strong>fileType:</strong> "csv" or "excel"</li>
                      <li><strong>delimiter:</strong> (CSV only) Field delimiter (default: ",")</li>
                      <li><strong>sheetName:</strong> (Excel only) Sheet name to read/write</li>
                    </ul>
                    <div className="mt-3 bg-gray-50 p-2 rounded">
                      <p className="text-xs font-mono text-gray-800 mb-2">CSV Example:</p>
                      <p className="text-xs font-mono text-gray-800">
                        {`{`}<br/>
                        &nbsp;&nbsp;"filePath": "/data/customers.csv",<br/>
                        &nbsp;&nbsp;"fileType": "csv",<br/>
                        &nbsp;&nbsp;"delimiter": ","<br/>
                        {`}`}
                      </p>
                    </div>
                    <div className="mt-3 bg-gray-50 p-2 rounded">
                      <p className="text-xs font-mono text-gray-800 mb-2">Excel Example:</p>
                      <p className="text-xs font-mono text-gray-800">
                        {`{`}<br/>
                        &nbsp;&nbsp;"filePath": "/data/sales.xlsx",<br/>
                        &nbsp;&nbsp;"fileType": "excel",<br/>
                        &nbsp;&nbsp;"sheetName": "Sheet1"<br/>
                        {`}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Best Practices */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">🔒 Security Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm ml-4">
                  <li><strong>Always use the password field</strong> - Never put passwords directly in the JSON configuration</li>
                  <li>Passwords are encrypted when saved to the database</li>
                  <li>When editing a connection, you must re-enter the password if you want to change it</li>
                  <li>Use strong, unique passwords for each connection</li>
                  <li>Limit connection permissions to only what's needed (read-only when possible)</li>
                </ul>
              </div>

              {/* Testing Connections */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">✅ Testing Connections</h4>
                <p className="text-blue-800 text-sm mb-2">
                  Always test your connection before saving:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm ml-4">
                  <li>Fill in all required fields</li>
                  <li>Enter the password in the password field</li>
                  <li>Click "Test Connection" button</li>
                  <li>Wait for success message</li>
                  <li>If successful, click "Save" to create the connection</li>
                </ol>
              </div>
            </div>
          );
      case 'query-tool':
          return (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Query Tool</h2>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-blue-900 font-medium">
                  The Query Tool allows you to test database connections, explore data, and create tasks directly from query results.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Purpose</h3>
                <p className="text-gray-700">
                  Use the Query Tool to:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700"><strong>Verify Connections:</strong> Test that your database connections work before using them in tasks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700"><strong>Explore Data:</strong> Run ad-hoc queries to understand your data structure and content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700"><strong>Test Queries:</strong> Validate your SQL queries before creating tasks with them</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700"><strong>Quick Task Creation:</strong> Create tasks directly from successful query results</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">How to Use</h3>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <ol className="list-decimal list-inside space-y-3 text-gray-700 ml-4">
                    <li>
                      <strong>Select a Connection</strong>
                      <p className="text-sm text-gray-600 ml-6 mt-1">
                        Choose a database connection from the dropdown. Only connections marked as "Can be Source" will appear.
                      </p>
                    </li>
                    <li>
                      <strong>Write Your Query</strong>
                      <p className="text-sm text-gray-600 ml-6 mt-1">
                        Enter a SQL query in the text area. Start with simple queries like <code className="bg-white px-1 py-0.5 rounded text-xs">SELECT * FROM table_name LIMIT 10</code>
                      </p>
                    </li>
                    <li>
                      <strong>Execute Query</strong>
                      <p className="text-sm text-gray-600 ml-6 mt-1">
                        Click the "Execute Query" button. The query will run against your selected connection.
                      </p>
                    </li>
                    <li>
                      <strong>Review Results</strong>
                      <p className="text-sm text-gray-600 ml-6 mt-1">
                        Results appear in a table below. You can scroll through rows and columns to verify the data.
                      </p>
                    </li>
                    <li>
                      <strong>(Optional) Create Task</strong>
                      <p className="text-sm text-gray-600 ml-6 mt-1">
                        If the query looks good, click "Create Task from Query" to automatically create a new task using this query as the source.
                      </p>
                    </li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Example Queries</h3>

                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 mb-2">List All Tables</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                      -- PostgreSQL<br/>
                      SELECT table_name FROM information_schema.tables<br/>
                      WHERE table_schema = 'public';
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 mb-2">Preview Table Data</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                      SELECT * FROM customers LIMIT 10;
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 mb-2">Count Records</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                      SELECT COUNT(*) as total_records FROM orders;
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 mb-2">Filter and Sort</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                      SELECT id, name, email, created_at<br/>
                      FROM users<br/>
                      WHERE created_at &gt;= '2024-01-01'<br/>
                      ORDER BY created_at DESC<br/>
                      LIMIT 100;
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 mb-2">Join Tables</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                      SELECT o.order_id, o.order_date, c.customer_name<br/>
                      FROM orders o<br/>
                      JOIN customers c ON o.customer_id = c.id<br/>
                      LIMIT 50;
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important Notes</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm ml-4">
                  <li>Queries run with the permissions of the connection user - make sure they have appropriate access</li>
                  <li>Large result sets may take time to load - use LIMIT to test with smaller datasets first</li>
                  <li>The Query Tool is read-only - it won't modify your data (unless you use UPDATE/DELETE)</li>
                  <li>Test your queries here before using them in production tasks</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">💡 Pro Tips</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800 text-sm ml-4">
                  <li>Always use LIMIT when testing queries to avoid loading too much data</li>
                  <li>Check column names and data types before creating tasks</li>
                  <li>Use WHERE clauses to filter data before loading into tasks</li>
                  <li>The "Create Task from Query" button saves time by pre-filling the source query</li>
                </ul>
              </div>
            </div>
          );
      case 'tasks':
          return (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Creating Tasks</h2>

              <p className="text-gray-700">
                Creating tasks is covered in detail in the <strong>Getting Started</strong> section. Refer to Step 3 for complete instructions on creating your first task.
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-blue-900 font-medium mb-2">
                  Quick Reference: Two Ways to Create Tasks
                </p>
                <ol className="list-decimal list-inside space-y-2 text-blue-800 ml-4">
                  <li>
                    <strong>From Tasks Page:</strong> Click "Create Task" button and fill in the form manually
                  </li>
                  <li>
                    <strong>From Query Tool:</strong> Run a query, then click "Create Task from Query" to auto-fill the source
                  </li>
                </ol>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Task Fields Explained</h3>

                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">Name</p>
                    <p className="text-sm text-gray-600">Give your task a descriptive name (e.g., "Daily Customer Sync")</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Source Connection</p>
                    <p className="text-sm text-gray-600">Where the data comes from (must be marked "Can be Source")</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Source Query/Config</p>
                    <p className="text-sm text-gray-600">SQL query for databases, or file path for files</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Target Connection</p>
                    <p className="text-sm text-gray-600">Where the data goes (must be marked "Can be Target")</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Target Table/File</p>
                    <p className="text-sm text-gray-600">Destination table name or file path</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Load Strategy</p>
                    <p className="text-sm text-gray-600">How to handle existing data:</p>
                    <ul className="list-disc list-inside ml-4 mt-1 text-xs text-gray-600 space-y-1">
                      <li><strong>append:</strong> Add to existing data</li>
                      <li><strong>truncate_and_load:</strong> Delete all rows, then insert new data</li>
                      <li><strong>drop_and_create:</strong> Drop table and recreate</li>
                      <li><strong>create_if_not_exists:</strong> Create table only if it doesn't exist</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Capture Logs</p>
                    <p className="text-sm text-gray-600">Enable this to view execution history and logs (recommended)</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 text-sm">
                  For step-by-step instructions with examples, see the <button onClick={() => setActiveSection('getting-started')} className="underline font-medium">Getting Started</button> guide.
                </p>
              </div>
            </div>
          );
      case 'teams':
          return (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Team Management</h2>

              <p className="text-gray-700">
                Teams allow you to organize and share connections and tasks with other users in your organization.
              </p>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">How Teams Work</h3>

                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>Team Isolation:</strong> All connections and tasks are specific to a team. Users in Team A cannot see resources from Team B.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>Multi-Team Access:</strong> Users can belong to multiple teams and switch between them using the team dropdown in the top navigation.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>Shared Resources:</strong> Everyone on a team can see and use all connections and tasks within that team.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Switching Teams</h3>

                <div className="bg-gray-50 rounded-lg p-4">
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                    <li>Click the team dropdown in the top navigation bar (next to your username)</li>
                    <li>Select the team you want to switch to from the list</li>
                    <li>All data in the application will update to show resources for the selected team</li>
                    <li>Your team selection is saved and will persist when you return to the application</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Team Management</h3>

                <p className="text-gray-700">
                  Team creation and user assignments are managed by system administrators. If you need to:
                </p>

                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 mt-2">
                  <li>Create a new team</li>
                  <li>Add users to a team</li>
                  <li>Remove users from a team</li>
                  <li>Change team settings</li>
                </ul>

                <p className="text-gray-700 mt-2">
                  Please contact your system administrator.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm ml-4">
                  <li>Always verify you're in the correct team before creating or modifying resources</li>
                  <li>Connections and tasks are NOT shared between teams</li>
                  <li>When you run a task, it runs in the context of the currently selected team</li>
                  <li>Execution history is team-specific</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm ml-4">
                  <li>Organize teams by department, project, or environment (Dev, QA, Prod)</li>
                  <li>Use descriptive team names that make it clear what the team is for</li>
                  <li>Double-check the team dropdown before running tasks in production</li>
                  <li>Consider creating separate teams for testing vs production workloads</li>
                </ul>
              </div>
            </div>
          );
      case 'faq':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {sections.find(s => s.id === activeSection)?.title}
            </h2>
            <p className="text-gray-700">
              Documentation for this section is coming soon. Please refer to the Overview and Getting Started guides for now.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Documentation</h2>
        </div>
        <nav className="p-2">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                {section.title}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// Admin Page Component
const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
  setLoading(true);
  try {
    if (activeTab === 'users') {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data.users || []);
    } else if (activeTab === 'teams') {
      const response = await fetch('/api/admin/teams');
      const data = await response.json();
      setTeams(data.teams || []);
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    setLoading(false);
  }
};

  const handleCreateUser = async () => {
    try {
      // ✅ Direct fetch
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowUserForm(false);
        setFormData({});
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to create user');
    }
  };

  const handleUpdateUser = async (userId) => {
    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setEditingUser(null);
        setFormData({});
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleCreateTeam = async () => {
    try {
      // ✅ Direct fetch
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowTeamForm(false);
        setFormData({});
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to create team');
    }
  };

  const handleUpdateTeam = async (teamId) => {
    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setEditingTeam(null);
        setFormData({});
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to update team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to deactivate this team? All team members will be removed.')) return;

    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to delete team');
    }
  };

  const handleAddUserToTeam = async (teamId, userId, role) => {
    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role })
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to add user to team');
    }
  };

  const handleRemoveUserFromTeam = async (teamId, userId) => {
    if (!confirm('Remove this user from the team?')) return;

    try {
      // ✅ Direct fetch
      const response = await fetch(`/api/admin/teams/${teamId}/members?userId=${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Failed to remove user from team');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="inline w-4 h-4 mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teams'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="inline w-4 h-4 mr-2" />
            Teams
          </button>
        </nav>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Users</h2>
            <button
              onClick={() => {
                setShowUserForm(true);
                setFormData({ email: '', password: '', first_name: '', last_name: '', is_admin: false });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {/* User Form Modal */}
          {(showUserForm || editingUser) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name || ''}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name || ''}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_admin"
                      checked={formData.is_admin || false}
                      onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="is_admin" className="text-sm text-gray-700">
                      Admin User
                    </label>
                  </div>

                  {editingUser && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active !== false}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <label htmlFor="is_active" className="text-sm text-gray-700">
                        Active
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      if (editingUser) {
                        handleUpdateUser(editingUser.id);
                      } else {
                        handleCreateUser();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUser ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowUserForm(false);
                      setEditingUser(null);
                      setFormData({});
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading users...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teams
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                              {user.is_admin && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.teams && user.teams.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.teams.map((t) => (
                              <span key={t.team_id} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                {t.team_name} ({t.role})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No teams</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({
                              email: user.email,
                              first_name: user.first_name,
                              last_name: user.last_name,
                              is_admin: user.is_admin,
                              is_active: user.is_active
                            });
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Teams</h2>
            <button
              onClick={() => {
                setShowTeamForm(true);
                setFormData({ name: '', description: '' });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Team
            </button>
          </div>

          {/* Team Form Modal */}
          {(showTeamForm || editingTeam) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingTeam ? 'Edit Team' : 'Create New Team'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Engineering, Marketing, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                      placeholder="Team description..."
                    />
                  </div>

                  {editingTeam && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="team_is_active"
                        checked={formData.is_active !== false}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <label htmlFor="team_is_active" className="text-sm text-gray-700">
                        Active
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      if (editingTeam) {
                        handleUpdateTeam(editingTeam.id);
                      } else {
                        handleCreateTeam();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingTeam ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowTeamForm(false);
                      setEditingTeam(null);
                      setFormData({});
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Teams List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading teams...</div>
          ) : (
            <div className="grid gap-4">
              {teams.map((team) => (
                <div key={team.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          team.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {team.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {team.member_count || 0} members
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTeam(team);
                          setFormData({
                            name: team.name,
                            description: team.description,
                            is_active: team.is_active
                          });
                        }}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-900"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Members</h4>
                    {team.members && team.members.length > 0 ? (
                      <div className="space-y-2">
                        {team.members.map((member) => (
                          <div key={member.user_id} className="flex justify-between items-center text-sm">
                            <div>
                              <span className="text-gray-900">{member.user_name}</span>
                              <span className="text-gray-500 ml-2">({member.user_email})</span>
                              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                {member.role}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveUserFromTeam(team.id, member.user_id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No members yet</p>
                    )}

                    {/* Add Member */}
                    <div className="mt-4 flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const [userId, role] = e.target.value.split(':');
                            handleAddUserToTeam(team.id, parseInt(userId), role);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">Add member...</option>
                        {users
                          .filter(u => u.is_active && !team.members?.some(m => m.user_id === u.id))
                          .map(u => (
                            <optgroup key={u.id} label={`${u.first_name} ${u.last_name} (${u.email})`}>
                              <option value={`${u.id}:member`}>as Member</option>
                              <option value={`${u.id}:admin`}>as Admin</option>
                              <option value={`${u.id}:viewer`}>as Viewer</option>
                            </optgroup>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Execution Monitor Component
const ExecutionMonitor = ({ executionId, onClose }) => {
  const [execution, setExecution] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutionData();
    const interval = setInterval(loadExecutionData, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [executionId]);

  const loadExecutionData = async () => {
    try {
      const teamId = localStorage.getItem('currentTeamId');

      // Get execution details
      const execResponse = await fetch(`/api/teams/${teamId}/executions/${executionId}`);
      const execData = await execResponse.json();
      setExecution(execData);

      // Get logs
      const logsResponse = await fetch(`/api/teams/${teamId}/executions/${executionId}/logs`);
      const logsData = await logsResponse.json();
      setLogs(logsData);

      setLoading(false);

      // Stop polling if execution is complete
      if (execData.status === 'success' || execData.status === 'failed') {
        // Don't clear interval, let cleanup handle it
      }
    } catch (error) {
      console.error('Failed to load execution data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'success': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLogLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
          <div className="text-center">Loading execution details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Task Execution</h2>
            <p className="text-sm text-gray-500">Execution ID: {executionId}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Status Bar */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Status</div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(execution?.status)}`}>
                {execution?.status}
              </span>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Records Read</div>
              <div className="text-lg font-semibold">{execution?.records_read || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Records Written</div>
              <div className="text-lg font-semibold">{execution?.records_written || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Duration</div>
              <div className="text-lg font-semibold">
                {execution?.duration_seconds ? `${execution.duration_seconds}s` :
                 execution?.status === 'running' ? '...' : '-'}
              </div>
            </div>
          </div>

          {execution?.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm font-medium text-red-800">Error:</div>
              <div className="text-sm text-red-700 mt-1">{execution.error_message}</div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Execution Logs</h3>

          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {execution?.status === 'running' ? 'Waiting for logs...' : 'No logs available'}
            </div>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className={`p-3 rounded ${getLogLevelColor(log.log_level)}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.logged_at).toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-semibold uppercase">
                      {log.log_level}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                  {log.context && (
                    <pre className="mt-2 text-xs overflow-x-auto">
                      {JSON.stringify(log.context)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {execution?.status === 'running' && (
              <span className="flex items-center gap-2">
                <Clock size={16} className="animate-spin" />
                Running... (auto-refreshing every 2s)
              </span>
            )}
            {execution?.status === 'success' && (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle size={16} />
                Completed successfully
              </span>
            )}
            {execution?.status === 'failed' && (
              <span className="flex items-center gap-2 text-red-600">
                <XCircle size={16} />
                Execution failed
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const DataPipelineApp = () => {
  const { data: session } = useSession();
  const currentUser = session?.user;
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [taskFormData, setTaskFormData] = useState(null);
  useEffect(() => {
    loadUserTeams();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'connections':
        return <ConnectionsPage />;
      case 'query':
        return <DataExplorerPage setCurrentPage={setCurrentPage} setTaskFormData={setTaskFormData} />;
      case 'tasks':
        return <TasksPage setCurrentPage={setCurrentPage} setTaskFormData={setTaskFormData} />;
      case 'create-task':
      case 'edit-task':
        return <TaskFormPage taskFormData={taskFormData} setCurrentPage={setCurrentPage} />;
      case 'admin':
        return <AdminPage />
      default:
        return <DashboardPage />;
    }
  };

  const loadUserTeams = async () => {
      try {
        const teams = await api.teams.list();
        setUserTeams(teams);

        if (teams.length > 0) {
          const savedTeamId = localStorage.getItem('currentTeamId');
          const defaultTeam = savedTeamId
            ? teams.find(t => t.id === parseInt(savedTeamId))
            : teams[0];

          const selectedTeam = defaultTeam || teams[0];
          setCurrentTeam(selectedTeam);
          localStorage.setItem('currentTeamId', selectedTeam.id.toString()); // ✅ Ensure it's a string
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      }
    };

  return (
    <TeamContext.Provider value={{ currentTeam, setCurrentTeam, currentUser }}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          currentUser={currentUser}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            setSidebarOpen={setSidebarOpen}
            userTeams={userTeams}
            currentUser={currentUser}
          />

          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'connections' && <ConnectionsPage />}
            {currentPage === 'query' && (
              <QueryToolPage
                setCurrentPage={setCurrentPage}
                setTaskFormData={setTaskFormData}
              />
            )}
            {currentPage === 'tasks' && (
            <TasksPage
                setCurrentPage={setCurrentPage}
                setTaskFormData={setTaskFormData}
              />
            )}
            {currentPage === 'task-form' && (
                <TaskFormPage
                    taskFormData={taskFormData}
                    setCurrentPage={setCurrentPage}
                />
              )}
            {currentPage === 'documentation' && <DocumentationPage />}
            {currentPage === 'admin' && <AdminPage />}
          </main>
        </div>
      </div>
    </TeamContext.Provider>
  );
};

export default DataPipelineApp;