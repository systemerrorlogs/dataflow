// =================================================
// TASK SCHEDULER IMPLEMENTATION
// =================================================
// This includes:
// 1. Cron expression builder UI component
// 2. Helper functions for cron conversion
// 3. Database schema updates
// 4. API routes for scheduler

// =================================================
// 1. CRON HELPER FUNCTIONS
// =================================================
// File: /lib/cronHelper.js

/**
 * Convert human-readable schedule to cron expression
 */
export function toCronExpression(schedule) {
  const { frequency, time, dayOfWeek, dayOfMonth } = schedule;

  switch (frequency) {
    case 'hourly':
      return `0 * * * *`; // Every hour at minute 0

    case 'daily':
      const [dailyHour, dailyMin] = (time || '00:00').split(':');
      return `${dailyMin} ${dailyHour} * * *`; // Daily at specified time

    case 'weekly':
      const [weeklyHour, weeklyMin] = (time || '00:00').split(':');
      const day = dayOfWeek || 0; // 0 = Sunday
      return `${weeklyMin} ${weeklyHour} * * ${day}`; // Weekly on specified day

    case 'monthly':
      const [monthlyHour, monthlyMin] = (time || '00:00').split(':');
      const dom = dayOfMonth || 1;
      return `${monthlyMin} ${monthlyHour} ${dom} * *`; // Monthly on specified day

    case 'custom':
      return schedule.cronExpression || null;

    default:
      return null;
  }
}

/**
 * Parse cron expression to human-readable format
 */
export function parseCronExpression(cronExpression) {
  if (!cronExpression) return null;

  const parts = cronExpression.trim().split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Hourly: "0 * * * *"
  if (hour === '*' && minute !== '*') {
    return { frequency: 'hourly', time: null };
  }

  // Daily: "30 14 * * *"
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return {
      frequency: 'daily',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    };
  }

  // Weekly: "0 9 * * 1"
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    return {
      frequency: 'weekly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dayOfWeek: parseInt(dayOfWeek)
    };
  }

  // Monthly: "0 9 15 * *"
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return {
      frequency: 'monthly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dayOfMonth: parseInt(dayOfMonth)
    };
  }

  // Custom
  return { frequency: 'custom', cronExpression };
}

/**
 * Validate cron expression
 */
export function isValidCron(cronExpression) {
  if (!cronExpression) return false;

  const parts = cronExpression.trim().split(' ');
  if (parts.length !== 5) return false;

  // Basic validation - each part should be a number, *, or range
  const regex = /^(\*|([0-9]|[1-5][0-9])([-\/,][0-9]|[1-5][0-9])*)$/;

  return parts.every(part => regex.test(part));
}

/**
 * Get next execution time from cron expression
 */
export function getNextRun(cronExpression) {
  // This would use a library like 'cron-parser' in production
  // For now, return a placeholder
  return 'Next run calculated by scheduler';
}

// =================================================
// 2. SCHEDULE BUILDER COMPONENT
// =================================================
// Add this to your TaskFormPage component



// =================================================
// 3. DATABASE SCHEMA UPDATE
// =================================================
// Add to your database migration file

/*
-- Add is_scheduled column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;

-- Add next_run column to track when task should run next
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_run TIMESTAMP;

-- Update the schedule_cron column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS schedule_cron VARCHAR(100);

-- Create index for faster scheduled task queries
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(is_scheduled, next_run) WHERE is_scheduled = TRUE;

-- Create scheduled_tasks_log table to track schedule changes
CREATE TABLE IF NOT EXISTS scheduled_tasks_log (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    old_schedule VARCHAR(100),
    new_schedule VARCHAR(100),
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

// =================================================
// 4. API ROUTE FOR SCHEDULE MANAGEMENT
// =================================================
// File: /app/api/teams/[teamId]/tasks/[taskId]/schedule/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { isValidCron } from '@/lib/cronHelper';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, taskId } = params;
    const { schedule_cron } = await request.json();

    // Validate cron expression
    if (schedule_cron && !isValidCron(schedule_cron)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      );
    }

    // Get current schedule for logging
    const currentTask = await query(
      'SELECT schedule_cron FROM tasks WHERE id = $1 AND team_id = $2',
      [taskId, teamId]
    );

    if (currentTask.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const oldSchedule = currentTask.rows[0].schedule_cron;

    // Update task schedule
    const result = await query(
      `UPDATE tasks
       SET schedule_cron = $1,
           is_scheduled = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND team_id = $4
       RETURNING *`,
      [schedule_cron, !!schedule_cron, taskId, teamId]
    );

    // Log the schedule change
    await query(
      `INSERT INTO scheduled_tasks_log (task_id, old_schedule, new_schedule, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [taskId, oldSchedule, schedule_cron, session.user.id]
    );

    return NextResponse.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Schedule update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Get schedule history
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;

    const result = await query(
      `SELECT sl.*, u.email as changed_by_email
       FROM scheduled_tasks_log sl
       LEFT JOIN users u ON sl.changed_by = u.id
       WHERE sl.task_id = $1
       ORDER BY sl.changed_at DESC
       LIMIT 50`,
      [taskId]
    );

    return NextResponse.json({
      history: result.rows
    });

  } catch (error) {
    console.error('Schedule history error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

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

// =================================================
// 6. ADD TO TASK FORM
// =================================================
// In your TaskFormPage component, add the ScheduleBuilder:

/*
import ScheduleBuilder from './ScheduleBuilder'; // or wherever you put it
import { toCronExpression } from '@/lib/cronHelper';

// In your TaskFormPage component:
const [scheduleCron, setScheduleCron] = useState(task?.schedule_cron || null);

// In your form JSX, add this section after the loading strategies:

<div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900 mb-3">
    Task Schedule (Optional)
  </h3>
  <p className="text-sm text-gray-600 mb-4">
    Schedule this task to run automatically on a recurring basis.
  </p>

  <ScheduleBuilder
    schedule={parseCronExpression(scheduleCron)}
    onChange={setScheduleCron}
  />
</div>

// In your handleSubmit function, add:
const taskData = {
  // ... existing fields ...
  schedule_cron: scheduleCron,
  is_scheduled: !!scheduleCron
};
*/

// =================================================
// 7. PACKAGE.JSON DEPENDENCIES
// =================================================
/*
Add to your package.json:

{
  "dependencies": {
    "cron-parser": "^4.9.0",
    "node-cron": "^3.0.3"
  }
}

Then run: npm install
*/

// =================================================
// 8. DEPLOYMENT NOTES
// =================================================
/*
For production deployment on Vercel:

1. Create a Vercel Cron Job:
   - Add vercel.json to your project root:

   {
     "crons": [{
       "path": "/api/cron/scheduler",
       "schedule": "* * * * *"
     }]
   }

2. Create the cron API route:
   File: /app/api/cron/scheduler/route.js

   import { NextResponse } from 'next/server';
   import { processScheduledTasks } from '@/lib/scheduler/worker';

   export async function GET(request) {
     // Verify this is from Vercel Cron
     const authHeader = request.headers.get('authorization');
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     try {
       await processScheduledTasks();
       return NextResponse.json({ success: true });
     } catch (error) {
       return NextResponse.json({ error: error.message }, { status: 500 });
     }
   }

3. Add CRON_SECRET to your Vercel environment variables

This will run your scheduler every minute to check for tasks that need to run.
*/

export { ScheduleBuilder, toCronExpression, parseCronExpression, isValidCron };