'use client';
import { useState, useEffect } from 'react';
import { PlayCircle, Edit, Trash2 } from 'lucide-react';
import LogsModal from '../components/LogsModal';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [logsModal, setLogsModal] = useState({
    isOpen: false,
    executionId: null,
    taskName: ''
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  // NEW: Handler for running a task with logs modal
  const handleRunTask = async (task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/execute`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to start task');

      const data = await response.json();

      // Open logs modal with the new execution ID
      setLogsModal({
        isOpen: true,
        executionId: data.execution_id,
        taskName: task.name
      });

      // Optionally refresh tasks list after a delay
      setTimeout(loadTasks, 3000);

    } catch (error) {
      alert('Failed to run task: ' + error.message);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks</h1>

      <table className="w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">Task Name</th>
            <th className="px-6 py-3 text-left">Source → Target</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} className="border-t hover:bg-gray-50">
              <td className="px-6 py-4">{task.name}</td>
              <td className="px-6 py-4">
                <span className="text-blue-600">{task.source_name}</span>
                {' → '}
                <span className="text-green-600">{task.target_name}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs ${
                  task.last_status === 'success' ? 'bg-green-100 text-green-800' :
                  task.last_status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.last_status || 'Never Run'}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  {/* NEW: Run button with logs modal */}
                  <button
                    onClick={() => handleRunTask(task)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    title="Run Task"
                  >
                    <PlayCircle size={18} />
                  </button>

                  <button
                    onClick={() => handleEdit(task)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit Task"
                  >
                    <Edit size={18} />
                  </button>

                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete Task"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* NEW: Logs Modal */}
      <LogsModal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal({ isOpen: false, executionId: null, taskName: '' })}
        executionId={logsModal.executionId}
        taskName={logsModal.taskName}
      />
    </div>
  );
}
