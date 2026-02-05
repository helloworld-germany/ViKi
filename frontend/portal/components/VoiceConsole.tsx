"use client";

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/config';
import styles from './VoiceConsole.module.css';

type Props = {
  consultId?: string;
};

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

type VoiceLiveTicket = {
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

type VoiceLiveServerEvent = {
  type: string;
  [key: string]: unknown;
};

const AUDIO_SAMPLE_RATE = 24000;
const AUDIO_BUFFER_SIZE = 4096;

export function VoiceConsole({ consultId }: Props) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const closingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackCursorRef = useRef(0);
  const threadNarrativeRef = useRef<string | undefined>(undefined);
  const threadPushedRef = useRef(false);
  const lastConsultIdRef = useRef<string | undefined>();
  const ticketRef = useRef<VoiceLiveTicket | null>(null);

  const shutdownStreams = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      playbackCursorRef.current = 0;
      void ctx.close().catch(() => undefined);
    } else {
      playbackCursorRef.current = 0;
    }
  }, []);

  const teardown = useCallback(
    (nextStatus: VoiceStatus = 'idle') => {
      const socket = wsRef.current;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        closingRef.current = true;
        socket.close();
      }
      wsRef.current = null;
      ticketRef.current = null;
      threadPushedRef.current = false;
      threadNarrativeRef.current = undefined;
      shutdownStreams();
      setStatus(nextStatus);
    },
    [shutdownStreams]
  );

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    const consultChanged =
      typeof lastConsultIdRef.current !== 'undefined' && consultId && lastConsultIdRef.current !== consultId;
    const shouldStop = (!consultId && status !== 'idle') || consultChanged;
    if (shouldStop) {
      teardown();
    }
    lastConsultIdRef.current = consultId;
  }, [consultId, status, teardown]);

  const ensureAudioContext = useCallback(async () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }
    const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    playbackCursorRef.current = ctx.currentTime;
    return ctx;
  }, []);

  const enqueuePlayback = useCallback(
    async (base64Audio: string) => {
      if (!base64Audio) {
        return;
      }
      const ctx = await ensureAudioContext();
      const samples = base64ToFloat32(base64Audio);
      if (!samples.length) {
        return;
      }
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startTime = Math.max(playbackCursorRef.current, ctx.currentTime);
      source.start(startTime);
      playbackCursorRef.current = startTime + buffer.duration;
    },
    [ensureAudioContext]
  );

  const pushThreadNarrative = useCallback(() => {
    if (threadPushedRef.current || !threadNarrativeRef.current) {
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: [
          'Narrate the NetSfere consult transcript below. Greet the clinician in German unless the consult is clearly English, summarize urgent pediatric findings, then offer next steps before asking how else you can help.',
          threadNarrativeRef.current
        ].join('\n\n')
      }
    };
    ws.send(JSON.stringify(payload));
    threadPushedRef.current = true;
  }, []);

  const handleServerMessage = useCallback(
    async (raw: string) => {
      let event: VoiceLiveServerEvent;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }

      switch (event.type) {
        case 'response.audio.delta':
          if (typeof event.delta === 'string') {
            await enqueuePlayback(event.delta);
          }
          break;
        case 'session.updated':
          pushThreadNarrative();
          break;
        case 'error':
          setError((event.error as { message?: string })?.message ?? 'Voice Live session reported an error');
          break;
        case 'warning':
          console.warn('Voice Live warning', event);
          break;
        default:
          break;
      }
    },
    [enqueuePlayback, pushThreadNarrative]
  );

  const startMicrophoneStreaming = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser cannot access the microphone.');
    }
    const ctx = await ensureAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: AUDIO_SAMPLE_RATE,
        echoCancellation: false,
        noiseSuppression: false
      }
    });
    mediaStreamRef.current = stream;

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
    processorRef.current = processor;
    source.connect(processor);
    const silence = ctx.createGain();
    silence.gain.value = 0;
    processor.connect(silence);
    silence.connect(ctx.destination);

    processor.onaudioprocess = (event) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      const channelData = event.inputBuffer.getChannelData(0);
      const encoded = float32ToBase64(channelData);
      if (encoded) {
        ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: encoded }));
      }
    };
  }, [ensureAudioContext]);

  const sendSessionUpdate = useCallback(() => {
    const ws = wsRef.current;
    const ticket = ticketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !ticket) {
      return;
    }

    const voiceType = inferVoiceType(ticket.voice);
    const payload = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: ticket.instructions,
        voice: {
          type: voiceType,
          name: ticket.voice
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_sampling_rate: AUDIO_SAMPLE_RATE,
        turn_detection: {
          type: 'azure_semantic_vad',
          threshold: 0.5,
          silence_duration_ms: 600,
          prefix_padding_ms: 200,
          interrupt_response: true,
          auto_truncate: true,
          create_response: true
        },
        temperature: 0.8,
        max_response_output_tokens: 'inf'
      }
    };

    ws.send(JSON.stringify(payload));
  }, []);

  const initializeVoiceLive = useCallback(
    (ticket: VoiceLiveTicket) => {
      const url = buildVoiceLiveSocketUrl(ticket);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ticketRef.current = ticket;
      closingRef.current = false;

      ws.onopen = () => {
        (async () => {
          try {
            await startMicrophoneStreaming();
            sendSessionUpdate();
            pushThreadNarrative();
            setStatus('live');
          } catch (err) {
            console.error('Failed to initialize audio pipeline', err);
            setError(err instanceof Error ? err.message : 'Unable to initialize audio pipeline');
            teardown('error');
          }
        })();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          void handleServerMessage(event.data);
        }
      };

      ws.onerror = () => {
        setError('Voice Live connection error');
        teardown('error');
      };

      ws.onclose = () => {
        const wasExpected = closingRef.current;
        closingRef.current = false;
        wsRef.current = null;
        ticketRef.current = null;
        shutdownStreams();
        threadPushedRef.current = false;
        threadNarrativeRef.current = undefined;
        if (!wasExpected) {
          setError('Voice Live session closed unexpectedly');
          setStatus('error');
        }
      };
    },
    [handleServerMessage, pushThreadNarrative, sendSessionUpdate, shutdownStreams, startMicrophoneStreaming, teardown]
  );

  const startSession = useCallback(async () => {
    if (!consultId || status === 'connecting' || status === 'live') {
      return;
    }

    setError(null);
    setStatus('connecting');

    try {
      const response = await fetch(`${API_BASE_URL}/consults/${consultId}/voice-ticket`, {
        method: 'POST',
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const ticket = (await response.json()) as VoiceLiveTicket;
      threadNarrativeRef.current = ticket.threadNarrative ?? undefined;
      threadPushedRef.current = false;
      initializeVoiceLive(ticket);
    } catch (err) {
      console.error('Failed to start Voice Live session', err);
      setError(err instanceof Error ? err.message : 'Failed to start Voice Live session');
      teardown('error');
    }
  }, [consultId, initializeVoiceLive, status, teardown]);

  const stopSession = useCallback(() => {
    if (status === 'live' || status === 'connecting') {
      teardown('idle');
    }
  }, [status, teardown]);

  const isActive = status === 'live';
  const statusCopy = consultId ? `Status: ${status}` : 'Select a consult to enable voice review';
  const statusDot =
    status === 'live' ? styles.statusLive : status === 'connecting' ? styles.statusConnecting : status === 'error' ? styles.statusError : styles.statusIdle;

  return (
    <section className={styles.console}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Voice Live session</p>
          <p className={styles.statusLine} aria-live="polite">
            <span className={clsx(styles.statusDot, statusDot)} aria-hidden="true" />
            <span>{statusCopy}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={!consultId || status === 'connecting'}
          onClick={isActive ? stopSession : startSession}
          aria-pressed={isActive}
          className={styles.toggleButton}
        >
          <span className={clsx(styles.toggleTrack, isActive && styles.toggleTrackActive)}>
            <span className={clsx(styles.toggleThumb, isActive && styles.toggleThumbActive)} />
          </span>
          {status === 'connecting' ? 'Connecting…' : isActive ? 'Stop session' : 'Start Voice Live'}
        </button>
      </div>
      {error && (
        <div className={styles.errorBanner}>
          <strong>Voice Live:</strong> {error}
        </div>
      )}
    </section>
  );
}

function inferVoiceType(voiceName: string): 'openai' | 'azure-standard' {
  const lower = voiceName.toLowerCase();
  const openAiVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  return openAiVoices.some((candidate) => lower.startsWith(candidate)) ? 'openai' : 'azure-standard';
}

function buildVoiceLiveSocketUrl(ticket: VoiceLiveTicket) {
  const normalizedEndpoint = ticket.endpoint.endsWith('/') ? ticket.endpoint.slice(0, -1) : ticket.endpoint;
  const wsBase = normalizedEndpoint.replace(/^http/i, 'ws');
  const params = new URLSearchParams();
  params.set('api-version', ticket.apiVersion);
  if (ticket.agentId) {
    params.set('agent_id', ticket.agentId);
    params.set('project_id', ticket.projectName);
  } else {
    params.set('model', ticket.model);
  }
  if (ticket.tokenType === 'apiKey') {
    params.set('api-key', ticket.token);
  } else {
    params.set('access_token', ticket.token);
  }
  return `${wsBase}/voice-live/realtime?${params.toString()}`;
}

function float32ToBase64(float32Data: Float32Array): string | null {
  if (!float32Data.length) {
    return null;
  }
  const buffer = new ArrayBuffer(float32Data.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Data.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return arrayBufferToBase64(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  if (!base64) {
    return EMPTY_FLOAT32;
  }
  const binary = atob(base64);
  const sampleCount = Math.floor(binary.length / 2);
  if (sampleCount <= 0) {
    return EMPTY_FLOAT32;
  }
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const index = i * 2;
    const lo = binary.charCodeAt(index);
    const hi = binary.charCodeAt(index + 1);
    let value = (hi << 8) | lo;
    if (value & 0x8000) {
      value = value - 0x10000;
    }
    float32[i] = value / 0x8000;
  }
  return float32;
}

const EMPTY_FLOAT32 = new Float32Array(0);
