'use client';
import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import LogsModal from './LogsModal';

export default function ExecutionHistoryModal({ isOpen, onClose, taskId, taskName }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState(null);

  useEffect(() => {
    if (!isOpen || !taskId) return;

    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks/${taskId}/executions`);
        if (!response.ok) throw new Error('Failed to fetch executions');
        
        const data = await response.json();
        setExecutions(data);
      } catch (error) {
        console.error('Failed to load executions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-600" size={16} />;
      case 'failed':
        return <XCircle className="text-red-600" size={16} />;
      case 'running':
        return <Clock className="text-blue-600" size={16} />;
      default:
        return <Clock className="text-gray-600" size={16} />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Execution History
              </h2>
              <p className="text-sm text-gray-500">{taskName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading executions...</div>
            ) : executions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No execution history available</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Started At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Completed At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Records
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {executions.map((execution) => {
                    const duration = execution.completed_at
                      ? Math.round(
                          (new Date(execution.completed_at) - new Date(execution.started_at)) / 1000
                        )
                      : null;

                    return (
                      <tr key={execution.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(execution.status)}
                            <span className="text-sm capitalize">{execution.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(execution.started_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {execution.completed_at
                            ? new Date(execution.completed_at).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {duration ? `${duration}s` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {execution.records_processed || 0}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedExecution(execution)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            title="View Logs"
                          >
                            <Eye size={16} />
                            <span className="text-sm">View Logs</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested Logs Modal */}
      {selectedExecution && (
        <LogsModal
          isOpen={!!selectedExecution}
          onClose={() => setSelectedExecution(null)}
          executionId={selectedExecution.id}
          taskName={`${taskName} - ${new Date(selectedExecution.started_at).toLocaleString()}`}
        />
      )}
    </>
  );
}
