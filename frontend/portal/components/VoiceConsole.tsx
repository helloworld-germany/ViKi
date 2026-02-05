"use client";

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/config';

type Props = {
  consultId?: string;
};

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

type VoiceTokenResponse = {
  clientSecret: string;
  baseUrl: string;
  apiVersion: string;
  sessionId: string;
  expiresAt?: string;
  model: string;
};

export function VoiceConsole({ consultId }: Props) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastConsultIdRef = useRef<string | undefined>(undefined);

  const teardown = useCallback((nextStatus: VoiceStatus = 'idle') => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setStatus(nextStatus);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    const hasSelectionChanged =
      typeof lastConsultIdRef.current !== 'undefined' && consultId && lastConsultIdRef.current !== consultId;
    const shouldStop = (!consultId && status !== 'idle') || hasSelectionChanged;
    if (shouldStop) {
      teardown();
    }
    lastConsultIdRef.current = consultId;
  }, [consultId, status, teardown]);

  const startSession = useCallback(async () => {
    if (!consultId || status === 'connecting' || status === 'live') {
      return;
    }

    setError(null);
    setStatus('connecting');

    try {
      const tokenRes = await fetch(`${API_BASE_URL}/consults/${consultId}/voice-token`, {
        method: 'POST',
        cache: 'no-store'
      });
      if (!tokenRes.ok) {
        throw new Error(await tokenRes.text());
      }
      const token = (await tokenRes.json()) as VoiceTokenResponse;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          void audioRef.current.play().catch(() => {
            /* autoplay already requested */
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setError('Realtime session disconnected');
          teardown('error');
        }
      };

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser cannot access the microphone.');
      }

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      if (!pc.localDescription?.sdp) {
        throw new Error('Missing local description');
      }

      const url = `${token.baseUrl}/openai/realtime?api-version=${token.apiVersion}`;
      const answerResponse = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.clientSecret}`,
          'Content-Type': 'application/sdp'
        },
        cache: 'no-store',
        body: pc.localDescription.sdp
      });

      if (!answerResponse.ok) {
        throw new Error(await answerResponse.text());
      }

      const answerSdp = await answerResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setStatus('live');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to start realtime session');
      teardown('error');
    }
  }, [consultId, status, teardown]);

  const stopSession = useCallback(() => {
    if (status === 'live' || status === 'connecting') {
      teardown('idle');
    }
  }, [status, teardown]);

  const isActive = status === 'live';
  const statusCopy = consultId ? `Status: ${status}` : 'Select a consult to enable voice review';
  const statusColor =
    status === 'live' ? 'bg-[#4ade80]' : status === 'connecting' ? 'bg-[#facc15]' : status === 'error' ? 'bg-[#f87171]' : 'bg-[#64748b]';

  return (
    <section className="rounded-2xl border border-[#20345f] bg-[rgba(10,18,34,0.85)] px-5 py-4 shadow-[0_10px_25px_rgba(5,11,26,0.6)]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Realtime voice</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-white" aria-live="polite">
            <span className={clsx('inline-flex h-2.5 w-2.5 rounded-full', statusColor)} aria-hidden="true" />
            <span>{statusCopy}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!consultId || status === 'connecting'}
          onClick={isActive ? stopSession : startSession}
          aria-pressed={isActive}
          className={clsx(
            'relative inline-flex items-center rounded-full px-6 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8efc]',
            isActive ? 'bg-[#5b8efc] text-white shadow-[0_10px_20px_rgba(39,97,255,0.35)]' : 'bg-[#101b34] text-[#9ab5ff] border border-[#324a82] disabled:opacity-40'
          )}
        >
          {status === 'connecting' ? 'Connecting…' : isActive ? 'Stop session' : 'Start realtime voice'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <audio ref={audioRef} autoPlay playsInline className="sr-only" />
    </section>
  );
}

async function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') {
    return;
  }

  await new Promise<void>((resolve) => {
    function checkState() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', checkState);
  });
}
