import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { Home, Database, Search, FileText, Plus, RefreshCw, Menu, X, User, LogOut, CheckCircle, XCircle, Clock, PlayCircle, Settings, ChevronDown, BookOpen, HelpCircle } from 'lucide-react';

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
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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
      await api.tasks.execute(taskId);
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
                        className="text-blue-600 hover:text-blue-800"
                        title="View Logs"
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
    </div>
  );
};

const ConnectionsPage = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
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
              <option value="database">Database</option>
              <option value="sftp">SFTP</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="api">API</option>
              <option value="flatfile">Flat File</option>
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

          <div className="flex gap-2 pt-4">
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
                        {row.map((cell, j) => (
                          <td key={j} className="px-6 py-4 text-sm text-gray-900">
                            {cell}
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

const TasksPage = ({ setCurrentPage }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

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
                      <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-xs">
                        Edit
                      </button>
                      <button
                        onClick={() => api.tasks.execute(task.id)}
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
    </div>
  );
};

const TaskFormPage = ({ taskFormData }) => {
  const [connections, setConnections] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceConnection, setSourceConnection] = useState(taskFormData?.sourceConnection || '');
  const [targetConnection, setTargetConnection] = useState('');
  const [sourceQuery, setSourceQuery] = useState(taskFormData?.sourceQuery || '');
  const [sourceWorksheet, setSourceWorksheet] = useState(taskFormData?.worksheetName || '');
  const [targetTable, setTargetTable] = useState('');
  const [targetWorksheet, setTargetWorksheet] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await api.connections.list();
      setConnections(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const handleSubmit = async () => {
    const sourceConn = connections.find(c => c.id === parseInt(sourceConnection));
    const targetConn = connections.find(c => c.id === parseInt(targetConnection));

    // Validation
    if (!name || !sourceConnection || !targetConnection || !sourceQuery || !targetTable) {
      alert('Please fill in all required fields');
      return;
    }

    if (sourceConn?.connection_type === 'excel' && !sourceWorksheet) {
      alert('Worksheet name is required for Excel source connections');
      return;
    }

    if (targetConn?.connection_type === 'excel' && !targetWorksheet) {
      alert('Worksheet name is required for Excel target connections');
      return;
    }

    try {
      setLoading(true);
      await api.tasks.create({
        name,
        description,
        source_connection_id: parseInt(sourceConnection),
        target_connection_id: parseInt(targetConnection),
        source_query: sourceQuery,
        source_worksheet: sourceWorksheet || undefined,
        target_table: targetTable,
        target_worksheet: targetWorksheet || undefined,
        transformation_config: {}
      });
      alert('Task created successfully!');
      setName('');
      setDescription('');
      setSourceConnection('');
      setTargetConnection('');
      setSourceQuery('');
      setSourceWorksheet('');
      setTargetTable('');
      setTargetWorksheet('');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert(`Failed to create task: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sourceConnections = connections.filter(c => c.can_be_source);
  const targetConnections = connections.filter(c => c.can_be_target);

  const selectedSourceConn = connections.find(c => c.id === parseInt(sourceConnection));
  const selectedTargetConn = connections.find(c => c.id === parseInt(targetConnection));
  const isSourceExcel = selectedSourceConn?.connection_type === 'excel';
  const isTargetExcel = selectedTargetConn?.connection_type === 'excel';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create Task</h1>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Data Pipeline Task"
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
            placeholder="Describe what this task does..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-gray-900">Source</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection *
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
                <p className="text-xs text-gray-500 mt-1">Required for Excel connections</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Query / Path *
              </label>
              <textarea
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder={isSourceExcel ? "/path/to/file.xlsx" : "SELECT * FROM table"}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-gray-900">Target</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection *
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
                <p className="text-xs text-gray-500 mt-1">Required for Excel connections</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table / Path *
              </label>
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder={isTargetExcel ? "/path/to/output.xlsx" : "target_table or /path/to/file.csv"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
          <button
  onClick={() => {
    // Navigate back to either tasks list or query tool depending on where we came from
    const fromQuery = localStorage.getItem('taskFormSource');
    if (fromQuery === 'query') {
      localStorage.removeItem('taskFormSource');
      window.location.hash = '#query';
      window.location.reload();
    } else {
      window.location.hash = '#tasks';
      window.location.reload();
    }
  }}
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
            {currentPage === 'tasks' && <TasksPage setCurrentPage={setCurrentPage} />}
            {currentPage === 'task-form' && <TaskFormPage taskFormData={taskFormData} />}
            {currentPage === 'documentation' && <DocumentationPage />}
          </main>
        </div>
      </div>
    </TeamContext.Provider>
  );
};

export default DataPipelineApp;