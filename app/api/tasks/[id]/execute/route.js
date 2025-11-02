import { NextResponse } from 'next/server';
import { query } from '@/lib/db';  // Update this path to match YOUR project

export async function POST(request, { params }) {
  try {
    const { id: taskId } = params;

       const taskCheck = await query(
      'SELECT id, name FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = taskCheck.rows[0];
\
    // Create execution record
    const executionResult = await query(
      `INSERT INTO task_executions (task_id, status, started_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [taskId, 'running']
    );

    const executionId = executionResult.rows[0].id;

    // Start async task execution (don't wait for it)
    executeTaskAsync(taskId, executionId, task.name).catch(err => {
      console.error('Async execution error:', err);
    });

    // Return execution_id immediately so modal can open
    const response = {
      success: true,
      execution_id: executionId
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Execute endpoint error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Async function that actually executes the task and writes logs
async function executeTaskAsync(taskId, executionId, taskName) {
  // Helper to write logs
  const writeLog = async (level, message) => {
    try {
      await query(
        `INSERT INTO task_execution_logs (execution_id, log_level, message, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [executionId, level, message]
      );
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  };

  try {
    // Write initial log
    await writeLog('info', `Starting execution of task: ${taskName}`);

    // Get task details
    await writeLog('info', 'Loading task configuration...');
    const taskResult = await query(
      `SELECT t.*,
              s.name as source_name, s.connection_type as source_type, s.config as source_config,
              tg.name as target_name, tg.connection_type as target_type, tg.config as target_config
       FROM tasks t
       LEFT JOIN connections s ON t.source_connection_id = s.id
       LEFT JOIN connections tg ON t.target_connection_id = tg.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      await writeLog('error', 'Task configuration not found');
      throw new Error('Task not found');
    }

    const task = taskResult.rows[0];
    await writeLog('info', `Source: ${task.source_name} (${task.source_type})`);
    await writeLog('info', `Target: ${task.target_name} (${task.target_type})`);

    // Simulate work (replace this with your actual ETL logic)
    await writeLog('info', 'Connecting to source...');
    await new Promise(r => setTimeout(r, 1000));

    await writeLog('info', 'Source connection established');
    await new Promise(r => setTimeout(r, 500));

    await writeLog('info', 'Connecting to target...');
    await new Promise(r => setTimeout(r, 1000));

    await writeLog('info', 'Target connection established');
    await new Promise(r => setTimeout(r, 500));

    await writeLog('info', 'Extracting data from source...');
    await new Promise(r => setTimeout(r, 1500));

    await writeLog('info', 'Extracted 100 records from source');
    await new Promise(r => setTimeout(r, 500));

    await writeLog('info', 'Transforming data...');
    await new Promise(r => setTimeout(r, 1000));

    await writeLog('info', 'Loading data to target...');
    await new Promise(r => setTimeout(r, 1500));

    await writeLog('success', 'Successfully loaded 100 records to target');

    // Update execution as successful
    await query(
      `UPDATE task_executions
       SET status = $1, completed_at = NOW(), records_processed = $2
       WHERE id = $3`,
      ['success', 100, executionId]
    );

    await writeLog('success', 'Task execution completed successfully');

  } catch (error) {
    console.error('Task execution failed:', error);

    // Write error log
    await writeLog('error', `Task execution failed: ${error.message}`);

    // Update execution as failed
    await query(
      `UPDATE task_executions
       SET status = $1, completed_at = NOW(), error_message = $2
       WHERE id = $3`,
      ['failed', error.message, executionId]
    );

  }
}