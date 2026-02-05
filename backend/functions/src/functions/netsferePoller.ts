import { app, InvocationContext, Timer } from '@azure/functions';
import { ingestLatestConversation } from '../lib/netsfereIngestion';

async function handler(timer: Timer, context: InvocationContext): Promise<void> {
  const isEnabled = process.env.NETSFERE_POLL_ENABLED === 'true';
  if (!isEnabled) {
    context.log('NetSfere poller disabled; skipping run.');
    return;
  }

  context.log(`NetSfere poller triggered at ${timer.scheduleStatus?.last || new Date().toISOString()}`);
  try {
    const stored = await ingestLatestConversation(context);
    context.log(`NetSfere poller persisted ${stored} message(s).`);
  } catch (error) {
    context.error('NetSfere poller failed to ingest latest conversation', error);
  }
}

app.timer('netsfere-poller', {
  schedule: '0 */1 * * * *',
  runOnStartup: false,
  handler
});
