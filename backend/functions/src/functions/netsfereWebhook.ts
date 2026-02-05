import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseWebhookPayload } from '../lib/netsfereClient';
import { ingestConversationFromPayload } from '../lib/netsfereIngestion';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await request.json();

    context.log('Received NetSfere webhook payload', body);

    const payload = parseWebhookPayload(body);
    const storedCount = await ingestConversationFromPayload(payload, context);
    context.log(`Stored ${storedCount} NetSfere messages from webhook payload.`);

    return {
      status: 202,
      jsonBody: { status: 'stored', messagesPersisted: storedCount }
    };
  } catch (error) {
    context.error('Failed to process NetSfere webhook', error);
    return {
      status: 500,
      jsonBody: { status: 'error', message: 'Unable to process consult' }
    };
  }
}

app.http('netsfere-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'netsfere/webhook',
  handler
});
