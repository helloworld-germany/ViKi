import axios from 'axios';
import { getEnv } from './env';
import type { HydratedConsult } from './consultRepository';

export type VoiceLiveSessionResponse = {
  clientSecret: string;
  sessionId: string;
  expiresAt?: string;
  baseUrl: string;
  apiVersion: string;
  model: string;
  voice: string;
};

const PCM_SAMPLE_RATE = 24000;

export async function createVoiceLiveSession(consult: HydratedConsult): Promise<VoiceLiveSessionResponse> {
  const env = getEnv();
  const baseUrl = normalizeEndpoint(env.AZURE_VOICELIVE_ENDPOINT);
  const url = `${baseUrl}/openai/realtime/sessions?api-version=${env.AZURE_VOICELIVE_API_VERSION}`;

  const instructions = buildConsultInstructions(consult);

  const payload = {
    model: env.AZURE_VOICELIVE_MODEL,
    modalities: ['text', 'audio'],
    voice: {
      type: 'azure-standard',
      name: env.AZURE_VOICELIVE_VOICE
    },
    instructions,
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_sampling_rate: PCM_SAMPLE_RATE,
    input_audio_noise_reduction: {
      type: 'azure_deep_noise_suppression'
    },
    input_audio_echo_cancellation: {
      type: 'server_echo_cancellation'
    },
    input_audio_transcription: {
      model: 'azure-speech',
      language: 'en-US'
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 400,
      create_response: true,
      interrupt_response: true
    }
  };

  const response = await axios.post(url, payload, {
    headers: {
      'api-key': env.AZURE_VOICELIVE_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const clientSecret = response.data?.client_secret?.value ?? response.data?.client_secret;
  if (!clientSecret) {
    throw new Error('Voice Live session did not return a client secret');
  }

  return {
    clientSecret,
    sessionId: response.data?.id,
    expiresAt: response.data?.expires_at,
    baseUrl,
    apiVersion: env.AZURE_VOICELIVE_API_VERSION,
    model: env.AZURE_VOICELIVE_MODEL,
    voice: env.AZURE_VOICELIVE_VOICE
  };
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
    preview
  ].join('\n');
}
