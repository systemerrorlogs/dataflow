// ============================================
// 2. DASHBOARD PAGE - Add Execution History to Logs Button
// ============================================
// File: app/dashboard/page.js

'use client';
import { useState, useEffect } from 'react';
import { FileText, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import ExecutionHistoryModal from '@/components/ExecutionHistoryModal';

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    taskId: null,
    taskName: ''
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  // NEW: Handler for viewing execution history
  const handleViewLogs = (task) => {
    setHistoryModal({
      isOpen: true,
      taskId: task.id,
      taskName: task.name
    });
  };

  const handleRetryTask = async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/execute`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to retry task');

      alert('Task started successfully');
      setTimeout(loadDashboard, 2000);
    } catch (error) {
      alert('Failed to retry task: ' + error.message);
    }
  };

  // Filter tasks by status
  const filteredTasks = selectedStatus === 'all'
    ? tasks
    : tasks.filter(t => t.last_status === selectedStatus);

  // Calculate status counts
  const statusCounts = {
    success: tasks.filter(t => t.last_status === 'success').length,
    failed: tasks.filter(t => t.last_status === 'failed').length,
    running: tasks.filter(t => t.last_status === 'running').length
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setSelectedStatus('success')}
          className={`p-6 bg-white rounded-lg border-2 transition-all ${
            selectedStatus === 'success' ? 'border-green-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={24} />
            <div className="text-3xl font-bold">{statusCounts.success}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Successful</div>
        </button>

        <button
          onClick={() => setSelectedStatus('failed')}
          className={`p-6 bg-white rounded-lg border-2 transition-all ${
            selectedStatus === 'failed' ? 'border-red-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <XCircle className="text-red-600" size={24} />
            <div className="text-3xl font-bold">{statusCounts.failed}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Failed</div>
        </button>

        <button
          onClick={() => setSelectedStatus('running')}
          className={`p-6 bg-white rounded-lg border-2 transition-all ${
            selectedStatus === 'running' ? 'border-blue-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="text-blue-600" size={24} />
            <div className="text-3xl font-bold">{statusCounts.running}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Running</div>
        </button>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Task Name</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Last Run</th>
              <th className="px-6 py-3 text-left">Records</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => (
              <tr key={task.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{task.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    task.last_status === 'success' ? 'bg-green-100 text-green-800' :
                    task.last_status === 'failed' ? 'bg-red-100 text-red-800' :
                    task.last_status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.last_status || 'pending'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4">{task.last_records || 0}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {/* NEW: View Logs button now opens execution history */}
                    <button
                      onClick={() => handleViewLogs(task)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="View Execution History"
                    >
                      <FileText size={18} />
                    </button>

                    <button
                      onClick={() => handleRetryTask(task.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Retry Task"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* NEW: Execution History Modal */}
      <ExecutionHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, taskId: null, taskName: '' })}
        taskId={historyModal.taskId}
        taskName={historyModal.taskName}
      />
    </div>
  );
}
