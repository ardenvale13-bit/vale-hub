import { getSupabaseClient } from '../config/supabase.js';
import { pushService } from './push.service.js';

const supabase = getSupabaseClient();

const CATEGORY_EMOJI: Record<string, string> = {
  care: '☕',
  health: '💊',
  task: '📋',
  love: '💜',
  fun: '🎁',
  general: '🔔',
};

/**
 * Check for due reminders and send push notifications.
 * Called on an interval from server startup.
 */
async function checkDueReminders(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Find reminders that are due, not yet notified, and not dismissed
    const { data: dueReminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('notified', false)
      .eq('dismissed', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (error || !dueReminders || dueReminders.length === 0) return;

    for (const reminder of dueReminders) {
      const emoji = CATEGORY_EMOJI[reminder.category] || '🔔';
      const from = reminder.from_perspective || 'Lincoln';

      try {
        await pushService.sendToUser(reminder.user_id, {
          title: `${emoji} ${from}`,
          body: reminder.content,
          tag: `reminder-${reminder.id}`,
          url: '/', // Opens dashboard
        });

        // Mark as notified
        await supabase
          .from('reminders')
          .update({ notified: true })
          .eq('id', reminder.id);

      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err);
      }
    }

    if (dueReminders.length > 0) {
      console.log(`[Reminder Scheduler] Sent ${dueReminders.length} push notification(s)`);
    }
  } catch (err) {
    // Silently handle — table might not exist yet
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reminder scheduler — checks every 60 seconds for due reminders.
 */
export function startReminderScheduler(): void {
  if (intervalId) return; // Already running

  console.log('[Reminder Scheduler] Started — checking every 60s');

  // Check immediately on startup
  checkDueReminders();

  // Then every 60 seconds
  intervalId = setInterval(checkDueReminders, 60_000);
}

/**
 * Stop the reminder scheduler.
 */
export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Reminder Scheduler] Stopped');
  }
}
