// =================================================
// 5. SCHEDULER WORKER (BACKGROUND PROCESS)
// =================================================
// File: /lib/scheduler/worker.js
// This would run as a separate process or serverless function

import { query } from '@/lib/db';
import parser from 'cron-parser';

export async function processScheduledTasks() {
  try {
    // Get all active scheduled tasks that are due to run
    const result = await query(
      `SELECT t.id, t.name, t.schedule_cron, t.team_id
       FROM tasks t
       WHERE t.is_active = TRUE
         AND t.is_scheduled = TRUE
         AND t.schedule_cron IS NOT NULL
         AND (t.next_run IS NULL OR t.next_run <= CURRENT_TIMESTAMP)`
    );

    for (const task of result.rows) {
      try {
        // Execute the task
        await executeTask(task.id, task.team_id);

        // Calculate next run time
        const interval = parser.parseExpression(task.schedule_cron);
        const nextRun = interval.next().toDate();

        // Update next_run time
        await query(
          'UPDATE tasks SET next_run = $1, last_run = CURRENT_TIMESTAMP WHERE id = $2',
          [nextRun, task.id]
        );

        console.log(`✅ Scheduled task ${task.id} (${task.name}) executed successfully`);
      } catch (error) {
        console.error(`❌ Failed to execute scheduled task ${task.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}

async function executeTask(taskId, teamId) {
  // Call your existing task execution API
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/teams/${teamId}/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Task execution failed with status ${response.status}`);
  }

  return await response.json();
}