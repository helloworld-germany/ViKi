import { BlobServiceClient, BlockBlobUploadOptions, ContainerClient } from '@azure/storage-blob';
import { getEnv } from './env';
import type { NetsfereMessage } from './netsfereClient';

function getContainerClient() {
  const env = getEnv();
  const blobClient = BlobServiceClient.fromConnectionString(env.AzureWebJobsStorage);
  return blobClient.getContainerClient(env.CONSULT_CONTAINER);
}

export type StoredConsult = {
  id: string;
  convId: number;
  msgId: number;
  senderEmail?: string;
  receivedAt: string;
  payload: NetsfereMessage;
};

export type StoredConsultSummary = {
  id: string;
  convId: number;
  latestMsgId: number;
  senderEmail?: string;
  receivedAt: string;
  snippet: string;
  msgType: string;
  messageCount: number;
};

export type HydratedConsult = StoredConsult & {
  thread: StoredConsult[];
};

async function ensureContainer() {
  const container = getContainerClient();
  await container.createIfNotExists();
  return container;
}

export async function saveConsult(record: StoredConsult) {
  const container = await ensureContainer();

  const blobName = `${record.id}.json`;
  const blockBlob = container.getBlockBlobClient(blobName);
  const body = JSON.stringify(record);
  const options: BlockBlobUploadOptions = {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    metadata: {
      sender: record.senderEmail ?? '',
      receivedat: record.receivedAt,
      msgtype: record.payload.msgType ?? 'text',
      snippet: record.payload.msgText?.slice(0, 256) ?? ''
    }
  };

  await blockBlob.upload(body, Buffer.byteLength(body), options);
}

export async function listConsults(): Promise<StoredConsultSummary[]> {
  const container = await ensureContainer();

  const conversations = new Map<number, StoredConsultSummary>();

  for await (const blob of container.listBlobsFlat()) {
    const { convId, msgId } = parseIdsFromBlob(blob.name);
    if (Number.isNaN(convId) || Number.isNaN(msgId)) {
      continue;
    }

    const metadata = blob.metadata ?? {};
    const receivedAt = metadata.receivedat || blob.properties?.createdOn?.toISOString() || new Date().toISOString();
    const snippet = metadata.snippet || '';
    const msgType = metadata.msgtype || 'text';
    const senderEmail = metadata.sender || undefined;

    const existing = conversations.get(convId);
    if (!existing) {
      conversations.set(convId, {
        id: `${convId}-${msgId}`,
        convId,
        latestMsgId: msgId,
        senderEmail,
        receivedAt,
        snippet,
        msgType,
        messageCount: 1
      });
      continue;
    }

    existing.messageCount += 1;

    const isNewerMessage = msgId > existing.latestMsgId || new Date(receivedAt).getTime() > new Date(existing.receivedAt).getTime();
    if (isNewerMessage) {
      existing.id = `${convId}-${msgId}`;
      existing.latestMsgId = msgId;
      existing.senderEmail = senderEmail;
      existing.receivedAt = receivedAt;
      existing.snippet = snippet;
      existing.msgType = msgType;
    }
  }

  return Array.from(conversations.values()).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function getConsult(id: string): Promise<HydratedConsult | undefined> {
  const container = await ensureContainer();
  const record = await loadConsult(container, id);
  if (!record) {
    return undefined;
  }

  const thread = await listConversationMessages(container, record.convId);
  return {
    ...record,
    thread
  };
}

async function streamToString(readable: NodeJS.ReadableStream | undefined) {
  if (!readable) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function parseIdsFromBlob(blobName: string) {
  const base = blobName.replace('.json', '');
  const [convId, msgId] = base.split('-').map((value) => Number(value));
  return { convId, msgId };
}

async function loadConsult(container: ContainerClient, id: string): Promise<StoredConsult | undefined> {
  const blobClientRef = container.getBlockBlobClient(`${id}.json`);
  if (!(await blobClientRef.exists())) {
    return undefined;
  }

  const download = await blobClientRef.download();
  const body = await streamToString(download.readableStreamBody);
  return JSON.parse(body) as StoredConsult;
}

async function listConversationMessages(container: ContainerClient, convId: number) {
  const messages: StoredConsult[] = [];
  const prefix = `${convId}-`;

  for await (const blob of container.listBlobsFlat({ prefix })) {
    const record = await loadConsult(container, blob.name.replace('.json', ''));
    if (record) {
      messages.push(record);
    }
  }

  return messages.sort((a, b) => a.msgId - b.msgId);
}
