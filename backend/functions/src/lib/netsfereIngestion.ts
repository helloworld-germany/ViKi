import type { InvocationContext } from '@azure/functions';
import {
  fetchMessageDetails,
  fetchConversationMessages,
  fetchLatestConversation,
  type NetsfereMessage,
  type NetsfereWebhookPayload
} from './netsfereClient';
import { saveConsult } from './consultRepository';

export type IngestionLogger = Pick<InvocationContext, 'log' | 'warn' | 'error'>;

export async function ingestConversationFromPayload(payload: NetsfereWebhookPayload, logger?: IngestionLogger) {
  const messages = await resolveConversationMessages(payload, logger);

  if (!messages.length) {
    logger?.warn?.('Unable to resolve any NetSfere messages; storing fallback placeholder.');
    const fallback = createFallbackMessage(payload);
    await persistMessages([fallback], logger);
    return 1;
  }

  return persistMessages(messages, logger);
}

export async function ingestLatestConversation(logger?: IngestionLogger) {
  const latest = await fetchLatestConversation();
  if (!latest?.messages?.length) {
    logger?.warn?.('No latest NetSfere conversation found to ingest.');
    return 0;
  }

  logger?.log?.(`Persisting latest NetSfere conversation convId=${latest.convId} (${latest.messages.length} messages).`);
  return persistMessages(latest.messages, logger);
}

async function resolveConversationMessages(payload: NetsfereWebhookPayload, logger?: IngestionLogger) {
  const convId = payload.convId ?? 0;
  const msgId = payload.msgId ?? 0;
  const hasExplicitIds = convId > 0 && msgId > 0;

  if (hasExplicitIds) {
    try {
      const message = await fetchMessageDetails({ ...payload, convId, msgId });
      if (message) {
        const conversation = await fetchConversationMessages(message.convId);
        if (conversation.length) {
          return conversation;
        }
        return [message];
      }
    } catch (error) {
      logger?.warn?.(`Failed exact NetSfere fetch for convId=${convId} msgId=${msgId}`, error as Error);
    }
  }

  try {
    const latest = await fetchLatestConversation();
    if (latest?.messages?.length) {
      logger?.log?.(
        `Fetched latest NetSfere conversation convId=${latest.convId} (${latest.messages.length} messages).`
      );
      return latest.messages;
    }
  } catch (error) {
    logger?.warn?.('Failed to fetch latest NetSfere conversation', error as Error);
  }

  return [] as NetsfereMessage[];
}

async function persistMessages(messages: NetsfereMessage[], logger?: IngestionLogger) {
  for (const message of messages) {
    await saveConsult({
      id: `${message.convId}-${message.msgId}`,
      convId: message.convId,
      msgId: message.msgId,
      senderEmail: message.senderEmail,
      receivedAt: toIsoTimestamp(message.created),
      payload: message
    });
  }
  logger?.log?.(`Stored ${messages.length} NetSfere message(s) in blob storage.`);
  return messages.length;
}

function createFallbackMessage(payload: NetsfereWebhookPayload): NetsfereMessage {
  const convId = payload.convId ?? 0;
  const msgId = payload.msgId ?? 0;
  return {
    msgId,
    convId,
    created: Date.now(),
    senderEmail: payload.senderEmail ?? 'unknown@netsfere',
    msgType: payload.msgType ?? 'text',
    msgText: payload.msgText ?? 'No message text provided by webhook.',
    attachment: null
  };
}

function toIsoTimestamp(epoch?: number) {
  if (!epoch) {
    return new Date().toISOString();
  }
  const ms = epoch > 1_000_000_000_000 ? epoch : epoch * 1000;
  return new Date(ms).toISOString();
}
