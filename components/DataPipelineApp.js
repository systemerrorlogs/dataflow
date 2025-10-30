import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { Home, Database, Search, FileText, Plus, RefreshCw, Menu, X, User, LogOut, CheckCircle, XCircle, Clock, PlayCircle, Settings, ChevronDown, BookOpen, HelpCircle } from 'lucide-react';
import LogsModal from './LogsModal';
import ExecutionHistoryModal from './ExecutionHistoryModal';
import { getEnabledConnectors, getConnectorMetadata, isConnectorEnabled } from '@/lib/config/connectors';

const TeamContext = createContext();

const api = {
  async call(endpoint, options = {}) {
    const teamId = localStorage.getItem('currentTeamId');
    const res = await fetch(`/api/teams/${teamId}${endpoint}`, {
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
  const { currentTeam } = useContext(TeamContext);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'connections', label: 'Connections', icon: Database },
    { id: 'query', label: 'Data Explorer', icon: Search },
    { id: 'tasks', label: 'Tasks', icon: FileText },
    { id: 'documentation', label: 'Documentation', icon: BookOpen }
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

  useEffect(() => {
    loadDashboard();
  }, []);

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
    config: {}
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
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      connection_type: connection.connection_type,
      can_be_source: connection.can_be_source,
      can_be_target: connection.can_be_target,
      config: connection.config || {}
    });
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
      if (editingConnection) {
        await api.connections.update(editingConnection.id, formData);
      } else {
        await api.connections.create(formData);
      }
      setShowForm(false);
      setEditingConnection(null);
      setFormData({
        name: '',
        connection_type: 'database',
        can_be_source: true,
        can_be_target: true,
        config: {}
      });
      await loadConnections();
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

        // Get current team ID from context or localStorage
        const currentTeamId = localStorage.getItem('currentTeamId');

        // Test the connection using the current form data
        const result = await fetch(`/api/teams/${currentTeamId}/connections/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection_type: formData.connection_type,
            config: formData.config
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
              <option value="excel">Excel</option>
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
      console.log('Editing task:', taskId);
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


const DocumentationPage = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: BookOpen },
    { id: 'getting-started', title: 'Getting Started', icon: PlayCircle }
  ];

  const renderContent = () => {
    if (activeSection === 'overview') {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
          <p className="text-gray-700">
            DataFlow is an enterprise data pipeline management platform that enables you to easily move data between different systems, databases, and file formats.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Key Features</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Multi-tenant team-based access control</li>
              <li>Support for multiple data sources and targets</li>
              <li>Visual query tool for testing data sources</li>
              <li>Automated task scheduling and execution</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Getting Started</h2>
        <p className="text-gray-700">Follow these steps to begin using DataFlow.</p>
      </div>
    );
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
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [taskFormData, setTaskFormData] = useState(null);
  const [currentUser, setCurrentUser] = useState({ name: 'John Doe', email: 'john@example.com' });

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
        setCurrentTeam(defaultTeam || teams[0]);
        localStorage.setItem('currentTeamId', (defaultTeam || teams[0]).id);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, setCurrentTeam }}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
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
          </main>
        </div>
      </div>
    </TeamContext.Provider>
  );
};

export default DataPipelineApp;