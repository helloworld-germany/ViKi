import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { fetchMessageDetails, parseWebhookPayload } from '../lib/netsfereClient';
import { saveConsult } from '../lib/consultRepository';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await request.json();

    context.log('Received NetSfere webhook payload', body);

    const payload = parseWebhookPayload(body);
    const message = await fetchMessageDetails(payload);

    if (!message) {
      context.warn(`No message details found for convId=${payload.convId} msgId=${payload.msgId}`);
      return {
        status: 202,
        jsonBody: { status: 'ignored', reason: 'Message not found' }
      };
    }

    await saveConsult({
      id: `${payload.convId}-${payload.msgId}`,
      convId: payload.convId,
      msgId: payload.msgId,
      senderEmail: payload.senderEmail,
      receivedAt: new Date().toISOString(),
      payload: message
    });

    return {
      status: 202,
      jsonBody: { status: 'stored' }
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
  handler
});
