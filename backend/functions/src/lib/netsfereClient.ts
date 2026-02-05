import axios from 'axios';
import { z } from 'zod';
import { getEnv } from './env';

export type NetsfereMessage = {
  msgId: number;
  convId: number;
  created: number;
  senderEmail: string;
  msgType: string;
  msgText: string;
  attachment?: {
    attachmentId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null;
};

const netsfereBaseUrl = process.env.NETSFERE_BASE_URL ?? 'https://api.netsfere.com';

const webhookPayloadSchema = z.object({
  convId: z.number().int().optional(),
  msgId: z.number().int().optional(),
  senderEmail: z.string().email().optional(),
  msgText: z.string().optional(),
  msgType: z.string().optional()
});

export type NetsfereWebhookPayload = z.infer<typeof webhookPayloadSchema>;

export function parseWebhookPayload(body: unknown): NetsfereWebhookPayload {
  const parsed = webhookPayloadSchema.parse(body ?? {});
  return {
    convId: parsed.convId ?? 0,
    msgId: parsed.msgId ?? 0,
    senderEmail: parsed.senderEmail,
    msgText: parsed.msgText,
    msgType: parsed.msgType
  };
}

export type NetsfereConversation = {
  convId: number;
  messages: NetsfereMessage[];
};

export async function fetchMessageDetails(payload: NetsfereWebhookPayload): Promise<NetsfereMessage | undefined> {
  const params = new URLSearchParams();
  params.set('convId', String(payload.convId));
  params.set('msgId', String(payload.msgId));

  const messages = await postToNetsfere(params);
  return messages[messages.length - 1];
}

export async function fetchConversationMessages(convId: number): Promise<NetsfereMessage[]> {
  if (!convId || convId <= 0) {
    return [];
  }

  const params = new URLSearchParams();
  params.set('convId', String(convId));
  params.set('msgId', '0');

  const messages = await postToNetsfere(params);
  return messages.sort((a, b) => a.msgId - b.msgId);
}

export async function fetchLatestConversation(): Promise<NetsfereConversation | undefined> {
  const params = new URLSearchParams();
  params.set('convId', '0');
  params.set('msgId', '0');

  const latestMessages = await postToNetsfere(params);
  const latest = latestMessages[latestMessages.length - 1];
  if (!latest) {
    return undefined;
  }

  const conversationMessages = await fetchConversationMessages(latest.convId);
  const messages = conversationMessages.length ? conversationMessages : latestMessages;
  return {
    convId: latest.convId,
    messages
  };
}

async function postToNetsfere(params: URLSearchParams): Promise<NetsfereMessage[]> {
  const env = getEnv();
  if (!params.has('convId')) {
    params.set('convId', '0');
  }
  if (!params.has('msgId')) {
    params.set('msgId', '0');
  }
  params.set('email', env.NETSFERE_EMAIL);
  params.set('password', env.NETSFERE_PASSWORD);

  const response = await axios.post(`${netsfereBaseUrl}/get`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  if (!Array.isArray(response.data) || response.data.length === 0) {
    return [];
  }

  return response.data as NetsfereMessage[];
}
