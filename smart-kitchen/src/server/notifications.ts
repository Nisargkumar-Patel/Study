/**
 * notifications.ts — AWS SNS dispatch for cooking-duty reminders.
 *
 * Two delivery modes:
 *   - Direct SMS: PublishCommand with a PhoneNumber (no topic needed).
 *   - Topic fan-out: publish to SNS_TOPIC_ARN if configured.
 *
 * The route layer decides WHO to notify (today's assigned cook); this module
 * only owns the AWS plumbing so it can be unit-tested / mocked independently.
 */
import { PublishCommand } from '@aws-sdk/client-sns';
import { getSnsClient } from '@/lib/aws';

export interface CookReminder {
  phone: string; // E.164, e.g. +14155550123
  cookName: string;
  dish: string;
  date: Date;
}

/**
 * Send a single SMS cook reminder. Returns the SNS MessageId on success.
 */
export async function sendCookReminder(reminder: CookReminder): Promise<string> {
  const dateStr = reminder.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const message =
    `🍽️ Smart Kitchen reminder: Hi ${reminder.cookName}, you're on cooking duty ` +
    `${dateStr}. Tonight's dish: ${reminder.dish}. Check the app for the scaled recipe (7 servings).`;

  const client = getSnsClient();
  const topicArn = process.env.SNS_TOPIC_ARN;

  const command = new PublishCommand(
    topicArn
      ? { TopicArn: topicArn, Message: message }
      : {
          PhoneNumber: reminder.phone,
          Message: message,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }
  );

  const res = await client.send(command);
  if (!res.MessageId) {
    throw new Error('SNS publish returned no MessageId');
  }
  return res.MessageId;
}

/** Dispatch reminders to many cooks; resilient to individual failures. */
export async function sendCookReminders(
  reminders: CookReminder[]
): Promise<{ sent: number; failures: Array<{ cookName: string; error: string }> }> {
  let sent = 0;
  const failures: Array<{ cookName: string; error: string }> = [];

  await Promise.all(
    reminders.map(async (r) => {
      try {
        await sendCookReminder(r);
        sent += 1;
      } catch (err) {
        failures.push({
          cookName: r.cookName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  return { sent, failures };
}
