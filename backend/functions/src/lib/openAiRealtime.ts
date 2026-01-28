import axios from 'axios';
import { getEnv } from './env';
import type { StoredConsult } from './consultRepository';

export type RealtimeSessionResponse = {
  clientSecret: string;
  sessionId: string;
  expiresAt?: string;
  baseUrl: string;
  apiVersion: string;
  model: string;
};

export async function createRealtimeSession(consult: StoredConsult): Promise<RealtimeSessionResponse> {
  const env = getEnv();
  const baseUrl = `https://${env.OPENAI_RESOURCE_NAME}.openai.azure.com`;
  const url = `${baseUrl}/openai/realtime/sessions?api-version=${env.OPENAI_API_VERSION}`;

  const context = buildContextFromConsult(consult);

  const payload = {
    model: env.OPENAI_REALTIME_DEPLOYMENT,
    voice: env.OPENAI_VOICE,
    instructions: context,
    modalities: ['text', 'audio'],
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: {
      model: 'whisper-1'
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 200,
      create_response: true
    }
  };

  const response = await axios.post(url, payload, {
    headers: {
      'api-key': env.OPENAI_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const clientSecret = response.data?.client_secret?.value ?? response.data?.client_secret;
  if (!clientSecret) {
    throw new Error('Realtime session did not return a client secret');
  }

  return {
    clientSecret,
    sessionId: response.data?.id,
    expiresAt: response.data?.expires_at,
    baseUrl,
    apiVersion: env.OPENAI_API_VERSION,
    model: env.OPENAI_REALTIME_DEPLOYMENT
  };
}

function buildContextFromConsult(consult: StoredConsult) {
  const preview = consult.payload.msgText?.slice(0, 400) ?? 'No text body was provided.';
  return `You are ViKi, a virtual pediatric specialist supporting asynchronous consults. Use the following context to answer with precision and keep replies concise.\n\nConsult ID: ${consult.id}\nSender: ${consult.senderEmail ?? 'unknown'}\nReceived: ${consult.receivedAt}\nMessage Type: ${consult.payload.msgType}\nMessage Preview: ${preview}`;
}
