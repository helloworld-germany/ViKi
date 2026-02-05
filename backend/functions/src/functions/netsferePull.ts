import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  fetchMessageDetails,
  fetchConversationMessages,
  fetchLatestConversation,
  parseWebhookPayload
} from '../lib/netsfereClient';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await readRequestData(request);
    const safeBody = body as Record<string, unknown>;
    const payload = parseWebhookPayload({
      convId: Number(safeBody.convId ?? safeBody.convID ?? 0),
      msgId: Number(safeBody.msgId ?? safeBody.msgID ?? 0),
      senderEmail: typeof safeBody.senderEmail === 'string' ? safeBody.senderEmail : undefined,
      msgText: typeof safeBody.msgText === 'string' ? safeBody.msgText : undefined,
      msgType: typeof safeBody.msgType === 'string' ? safeBody.msgType : undefined
    });

    const result = await fetchConversationOrMessage(payload, context);

    if (!result) {
      return {
        status: 404,
        jsonBody: { error: 'Message not found. Verify convId/msgId or ensure credentials have access.' }
      };
    }

    return {
      status: 200,
      jsonBody: {
        fetchedAt: new Date().toISOString(),
        ...result
      }
    };
  } catch (error) {
    context.error('Failed to fetch NetSfere message', error);
    return {
      status: 400,
      jsonBody: { error: 'Unable to fetch NetSfere message. Provide convId and msgId in JSON body.' }
    };
  }
}

app.http('netsfere-pull', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'netsfere/pull',
  handler
});

async function fetchConversationOrMessage(payload: ReturnType<typeof parseWebhookPayload>, context: InvocationContext) {
  const convId = payload.convId ?? 0;
  const msgId = payload.msgId ?? 0;

  if (!convId || convId <= 0) {
    context.log('No convId supplied; fetching latest NetSfere conversation.');
    const latest = await fetchLatestConversation();
    if (!latest) {
      return undefined;
    }
    return {
      mode: 'latest-conversation',
      conversation: latest
    };
  }

  if (!msgId || msgId <= 0) {
    const messages = await fetchConversationMessages(convId);
    if (!messages.length) {
      return undefined;
    }
    return {
      mode: 'conversation',
      conversation: {
        convId,
        messages
      }
    };
  }

  const message = await fetchMessageDetails(payload);
  if (!message) {
    return undefined;
  }
  const conversation = await fetchConversationMessages(message.convId);
  return {
    mode: 'message',
    message,
    conversation: {
      convId: message.convId,
      messages: conversation.length ? conversation : [message]
    }
  };
}

async function readRequestData(request: HttpRequest): Promise<Record<string, unknown>> {
  if (request.method === 'GET') {
    const entries: [string, string][] = [];
    const query = request.query;
    if (query) {
      entries.push(...Array.from(query.entries()));
    }
    return Object.fromEntries(entries);
  }

  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
