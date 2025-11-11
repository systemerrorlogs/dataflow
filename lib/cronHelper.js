export function toCronExpression(schedule) {
  if (!schedule || !schedule.frequency) {
    return null;
  }

  const { frequency, time, dayOfWeek, dayOfMonth, cronExpression } = schedule;

  if (frequency === 'custom') {
    return cronExpression;
  }

  // Parse time (HH:MM)
  const [hour, minute] = (time || '00:00').split(':').map(Number);

  switch (frequency) {
    case 'hourly':
      return '0 * * * *'; // Every hour at :00

    case 'daily':
      return `${minute} ${hour} * * *`; // Every day at specified time

    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek || 0}`; // Every week on specified day

    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth || 1} * *`; // Every month on specified day

    default:
      return null;
  }
}

export function parseCronExpression(cronExpression) {
  if (!cronExpression) {
    return { frequency: 'none' };
  }

  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    return { frequency: 'custom', cronExpression };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Hourly: 0 * * * *
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { frequency: 'hourly' };
  }

  // Daily: M H * * *
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return {
      frequency: 'daily',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    };
  }

  // Weekly: M H * * D
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    return {
      frequency: 'weekly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dayOfWeek: parseInt(dayOfWeek)
    };
  }

  // Monthly: M H D * *
  if (month === '*' && dayOfWeek === '*' && dayOfMonth !== '*') {
    return {
      frequency: 'monthly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dayOfMonth: parseInt(dayOfMonth)
    };
  }

  // Custom
  return { frequency: 'custom', cronExpression };
}

export function isValidCron(expression) {
  if (!expression) return false;
  
  const parts = expression.split(' ');
  if (parts.length !== 5) return false;

  // Basic validation - each part should be a number, *, or range
  const cronRegex = /^(\*|([0-9]|[1-5][0-9])(-([0-9]|[1-5][0-9]))?(\/[0-9]+)?(,([0-9]|[1-5][0-9])(-([0-9]|[1-5][0-9]))?)*)$/;
  
  return parts.every(part => cronRegex.test(part));
}