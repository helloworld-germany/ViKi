import { execFile } from 'child_process';
import { promisify } from 'util';
import { DefaultAzureCredential } from '@azure/identity';
import { getEnv } from './env';
import type { HydratedConsult } from './consultRepository';

export type VoiceLiveTicket = {
  endpoint: string;
  projectName: string;
  agentId?: string;
  apiVersion: string;
  model: string;
  voice: string;
  token: string;
  tokenType: 'aad' | 'apiKey';
  tokenExpiresOn?: string;
  instructions: string;
  threadNarrative?: string;
};

const credential = new DefaultAzureCredential();
const DEFAULT_SCOPE = 'https://voicelive.azure.com/.default';
const execFileAsync = promisify(execFile);

export async function createVoiceLiveTicket(consult: HydratedConsult): Promise<VoiceLiveTicket> {
  const env = getEnv();
  const instructions = buildConsultInstructions(consult);
  const threadNarrative = buildThreadNarrative(consult);

  if (env.AZURE_VOICELIVE_API_KEY) {
    return {
      endpoint: normalizeEndpoint(env.AZURE_VOICELIVE_ENDPOINT),
      projectName: env.AZURE_VOICELIVE_PROJECT_NAME,
      agentId: env.AZURE_VOICELIVE_AGENT_ID,
      apiVersion: env.AZURE_VOICELIVE_API_VERSION,
      model: env.AZURE_VOICELIVE_MODEL,
      voice: env.AZURE_VOICELIVE_VOICE,
      token: env.AZURE_VOICELIVE_API_KEY,
      tokenType: 'apiKey',
      instructions,
      threadNarrative
    };
  }

  const scope = env.AZURE_VOICELIVE_SCOPE ?? DEFAULT_SCOPE;
  const aadToken = await acquireAzureAdToken(scope);

  return {
    endpoint: normalizeEndpoint(env.AZURE_VOICELIVE_ENDPOINT),
    projectName: env.AZURE_VOICELIVE_PROJECT_NAME,
    agentId: env.AZURE_VOICELIVE_AGENT_ID,
    apiVersion: env.AZURE_VOICELIVE_API_VERSION,
    model: env.AZURE_VOICELIVE_MODEL,
    voice: env.AZURE_VOICELIVE_VOICE,
    token: aadToken.token,
    tokenType: 'aad',
    tokenExpiresOn: aadToken.expiresOn,
    instructions,
    threadNarrative
  };
}

type AccessTokenPayload = {
  token: string;
  expiresOn?: string;
};

async function acquireAzureAdToken(scope: string): Promise<AccessTokenPayload> {
  try {
    const token = await credential.getToken(scope);
    if (token?.token) {
      return {
        token: token.token,
        expiresOn: token.expiresOnTimestamp ? new Date(token.expiresOnTimestamp).toISOString() : undefined
      };
    }
    throw new Error('DefaultAzureCredential returned an empty token.');
  } catch (primaryError) {
    const cliToken = await tryAzureCliFallback(scope, primaryError as Error);
    return cliToken;
  }
}

async function tryAzureCliFallback(scope: string, primaryError: Error): Promise<AccessTokenPayload> {
  try {
    return await getTokenViaAzureCli(scope);
  } catch (cliError) {
    const combinedMessage = [
      'Unable to acquire an Azure AD token for Voice Live.',
      `DefaultAzureCredential: ${primaryError.message}`,
      `Azure CLI fallback: ${(cliError as Error).message}`
    ].join('\n');
    const error = new Error(combinedMessage);
    (error as Error & { cause?: unknown }).cause = { primaryError, cliError };
    throw error;
  }
}

async function getTokenViaAzureCli(scope: string): Promise<AccessTokenPayload> {
  const cliPath = resolveAzureCliPath();
  const args = ['account', 'get-access-token', '--scope', scope, '--output', 'json'];
  try {
    const { stdout } = await execFileAsync(cliPath, args, { windowsHide: true });
    const parsed = JSON.parse(stdout.trim());
    const token = (parsed.accessToken ?? parsed.token)?.toString();
    if (!token) {
      throw new Error('Azure CLI response did not contain an access token.');
    }
    const expiresOn = normalizeCliExpiry(parsed.expiresOn ?? parsed.expiresOnTimestamp ?? parsed.expiresOnUtc);
    return { token, expiresOn };
  } catch (error) {
    throw new Error(`Azure CLI (${cliPath}) could not provide a Voice Live token. Run "az login" and ensure this command works: az account get-access-token --scope ${scope}. Underlying error: ${(error as Error).message}`);
  }
}

function resolveAzureCliPath() {
  const explicit = process.env.AZURE_CLI_PATH;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:/Windows';
    return `${systemRoot}/System32/az.cmd`;
  }

  return 'az';
}

function normalizeCliExpiry(value?: string | number): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * (value > 1_000_000_000_000 ? 1 : 1000)).toISOString();
  }
  if (!value) {
    return undefined;
  }
  const stringValue = value.toString().trim();
  const isoLike = stringValue.includes('T') ? stringValue : `${stringValue.replace(' ', 'T')}Z`;
  const timestamp = Date.parse(isoLike);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}

function buildConsultInstructions(consult: HydratedConsult) {
  const messages = (consult.thread?.length ? consult.thread : [consult]).sort((a, b) => a.msgId - b.msgId);
  const latestMessage = messages[messages.length - 1];
  const preview = latestMessage.payload.msgText?.slice(0, 600)?.trim() ?? 'No text body was provided.';

  const attachmentSummary = latestMessage.payload.attachment
    ? `Attachment: ${latestMessage.payload.attachment.fileName} (${latestMessage.payload.attachment.mimeType}, ${latestMessage.payload.attachment.fileSize} bytes).`
    : 'No attachments were included.';

  const transcript = messages
    .slice(-6)
    .map((message) => {
      const author = message.senderEmail ?? 'Unknown';
      const body = message.payload.msgText?.replace(/\s+/g, ' ').trim() || '[no text body]';
      return `#${message.msgId} ${author}: ${body.slice(0, 240)}`;
    })
    .join('\n');

  return [
    'You are ViKi, a virtual pediatric specialist supporting asynchronous NetSfere consults.',
    'Speak German by default; switch to English only when the consult text is clearly written in English. Keep replies medically precise and under 45 seconds.',
    `Consult metadata: id=${consult.id}, convId=${consult.convId}, msgId=${consult.msgId}, messages=${messages.length}.`,
    `Sender: ${consult.senderEmail ?? 'unknown'}. Latest message received at ${consult.receivedAt}.`,
    attachmentSummary,
    'Recent conversation snippets (newest last):',
    transcript,
    'Latest message preview (first 600 chars):',
    preview,
    'When audio begins, greet the clinician, summarize the situation, and offer proactive suggestions before asking how else you can assist.'
  ].join('\n');
}

function buildThreadNarrative(consult: HydratedConsult) {
  const messages = (consult.thread?.length ? consult.thread : [consult]).sort((a, b) => a.msgId - b.msgId);
  const narrative = messages
    .map((message) => {
      const sender = message.senderEmail ?? 'Unknown sender';
      const received = new Date(message.receivedAt).toLocaleString();
      const body = message.payload.msgText?.trim() || '[no text body provided]';
      return `Message #${message.msgId} from ${sender} at ${received} (conv ${message.convId}):\n${body}`;
    })
    .join('\n---\n');

  const MAX_LENGTH = 8000;
  return narrative.length > MAX_LENGTH ? narrative.slice(-MAX_LENGTH) : narrative;
}
