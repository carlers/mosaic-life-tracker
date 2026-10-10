// Unscheduled and malformed-date tasks are owner-only, even in shared categories.
function isScheduledTask(task) {
  const value = task && task.date;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}
module.exports = { isScheduledTask };
