'use client';
import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';

export default function LogsModal({ isOpen, onClose, executionId, taskName }) {
  console.log('🔵 LogsModal render:', { isOpen, executionId, taskName });

  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('running');
  const [error, setError] = useState(null);
  const logsEndRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    console.log('🔵 useEffect triggered:', { isOpen, executionId });

    if (!isOpen || !executionId) {
      console.log('🔴 Not fetching logs - isOpen:', isOpen, 'executionId:', executionId);
      return;
    }

    const fetchLogs = async () => {
      try {
        const url = `/api/tasks/executions/${executionId}/logs`;
        console.log('🔵 Fetching logs from:', url);

        const response = await fetch(url);
        console.log('🔵 Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔴 Response not OK:', errorText);
          throw new Error('Failed to fetch logs');
        }

        const data = await response.json();
        console.log('🔵 Received data:', data);
        console.log('🔵 Logs count:', data.logs?.length || 0);

        setLogs(data.logs || []);
        setStatus(data.status);

        if (data.status === 'success' || data.status === 'failed') {
          console.log('🟢 Task completed, stopping polling');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      } catch (err) {
        console.error('🔴 Error fetching logs:', err);
        setError(err.message);
      }
    };

    console.log('🔵 Starting initial fetch');
    fetchLogs();

    console.log('🔵 Setting up polling interval');
    intervalRef.current = setInterval(fetchLogs, 2000);

    return () => {
      console.log('🔵 Cleaning up interval');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, executionId]);

  if (!isOpen) {
    console.log('🔴 Modal not open, not rendering');
    return null;
  }

  console.log('🔵 Rendering modal with', logs.length, 'logs');

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'failed':
        return <AlertCircle className="text-red-600" size={20} />;
      case 'running':
        return <Clock className="text-blue-600 animate-spin" size={20} />;
      default:
        return <FileText className="text-gray-600" size={20} />;
    }
  };

  const getLogLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return 'text-red-600';
      case 'warn':
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Task Execution Logs
              </h2>
              <p className="text-sm text-gray-500">{taskName}</p>
              <p className="text-xs text-gray-400">Execution ID: {executionId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className={`px-4 py-2 border-b ${
          status === 'success' ? 'bg-green-50 border-green-200' :
          status === 'failed' ? 'bg-red-50 border-red-200' :
          status === 'running' ? 'bg-blue-50 border-blue-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-sm font-medium">
            Status: <span className="capitalize">{status}</span>
            {status === 'running' && ' (Refreshing every 2 seconds...)'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {status === 'running' ? 'Waiting for logs...' : 'No logs available'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Execution ID: {executionId}
              </p>
              <p className="text-xs text-gray-400">
                Check browser console for debug info
              </p>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="flex gap-2 py-1 px-2 hover:bg-white rounded"
                >
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span className={`font-semibold flex-shrink-0 ${getLogLevelColor(log.log_level)}`}>
                    [{log.log_level?.toUpperCase() || 'INFO'}]
                  </span>
                  <span className="text-gray-800">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>{logs.length} log {logs.length === 1 ? 'entry' : 'entries'}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}