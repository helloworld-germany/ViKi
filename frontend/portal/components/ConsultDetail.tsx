"use client";

import { useState } from 'react';
import type { ConsultDetail as ConsultDetailType, ConsultMessage } from '../lib/types';

type Props = {
  consult: ConsultDetailType;
};

export function ConsultDetail({ consult }: Props) {
  const [isThreadExpanded, setIsThreadExpanded] = useState(false);
  const thread = consult.thread.length ? consult.thread : [consult];
  const latest = thread[thread.length - 1];
  const messageType = (latest.payload.msgType ?? 'text').toUpperCase();
  const sender = latest.senderEmail ?? 'Unknown';
  const receivedAt = new Date(latest.receivedAt).toLocaleString();
  const messageText = latest.payload.msgText || 'No text body received.';
  const attachment = latest.payload.attachment;
  const contextPreview = buildContextPreview(thread);
  const contextSummary = contextPreview?.replace(/\n+/g, ' ').trim() || 'Not available yet.';
  const hasThread = thread.length > 1;

  return (
    <section className="flex-1 rounded-3xl border border-[#1b2b4f] bg-[#0c1424ee] p-6 shadow-[0_30px_60px_rgba(4,8,20,0.75)]">
      <header className="border-b border-[#1c335c] pb-5">
        <p className="text-[11px] uppercase tracking-[0.5em] text-[#6e7fae]">Selected consult</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <h2 className="text-3xl font-semibold text-white">Consult {consult.id}</h2>
          <span className="rounded-full border border-[#5c7cff] bg-[rgba(92,124,255,0.18)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#b9c7ff]">
            {messageType}
          </span>
        </div>
        <dl className="mt-4 grid gap-4 text-sm text-[var(--muted)] md:grid-cols-3">
          <div>
            <dt className="uppercase tracking-[0.3em] text-[10px]">Sender</dt>
            <dd className="mt-1 text-base text-white">{sender}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.3em] text-[10px]">Received</dt>
            <dd className="mt-1 text-base text-white">{receivedAt}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.3em] text-[10px]">Conversation</dt>
            <dd className="mt-1 text-base text-white">
              #{consult.convId} · {thread.length} msg{thread.length === 1 ? '' : 's'}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[#1f335b] bg-[#101a32] p-4">
          <h3 className="text-[11px] uppercase tracking-[0.4em] text-[#7f8fbf]">Message type</h3>
          <p className="mt-3 text-2xl font-semibold text-white">{messageType}</p>
          <p className="mt-1 text-sm text-[#93a7d8]">Latest message #{latest.msgId}</p>
        </article>
        <article className="rounded-2xl border border-[#1f335b] bg-gradient-to-br from-[#152444] to-[#0f192f] p-4 md:col-span-2">
          <h3 className="text-[11px] uppercase tracking-[0.4em] text-[#7f8fbf]">AI Context Preview</h3>
          <p className="mt-3 text-base leading-relaxed text-white">{contextSummary}</p>
        </article>
      </div>

      <div className="mt-6 rounded-2xl border border-[#1f335b] bg-[#0f1627] p-5">
        <h3 className="text-[11px] uppercase tracking-[0.4em] text-[#7f8fbf]">Full Message</h3>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-white">{messageText}</p>
      </div>

      {attachment && (
        <footer className="mt-6 rounded-2xl border border-[#1f335b] bg-[#0f1a30] p-4 text-sm text-[var(--muted)]">
          <p className="text-[11px] uppercase tracking-[0.4em]">Attachment</p>
          <p className="mt-2 text-base text-white">
            {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} kB)
          </p>
        </footer>
      )}

      {hasThread && (
        <div className="mt-6 rounded-2xl border border-[#1f335b] bg-[#0b152a] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)]">
              Conversation Thread ({thread.length})
            </h3>
            <button
              type="button"
              className="rounded-full border border-[#334f91] px-4 py-1 text-xs font-semibold text-[#9ab5ff] transition hover:bg-[#10224d]"
              onClick={() => setIsThreadExpanded((prev) => !prev)}
            >
              {isThreadExpanded ? 'Hide details' : 'Show details'}
            </button>
          </div>
          {isThreadExpanded && (
            <div className="mt-4 space-y-4">
              {thread.map((message) => (
                <article key={message.id} className="rounded-2xl border border-[#1c3b6b] bg-[#111c2f] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span>
                      #{message.msgId} · {message.senderEmail ?? 'Unknown sender'}
                    </span>
                    <span>{new Date(message.receivedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">
                    {message.payload.msgText || 'No text body received.'}
                  </p>
                  {message.payload.attachment && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Attachment: {message.payload.attachment.fileName} ({Math.round(message.payload.attachment.fileSize / 1024)} kB)
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function buildContextPreview(thread: ConsultMessage[]) {
  if (!thread.length) {
    return 'No preview available.';
  }
  const window = thread.slice(-3).map((message) => {
    const sender = message.senderEmail ?? 'Unknown';
    const text = message.payload.msgText?.trim();
    return `${sender}: ${text && text.length ? text.slice(0, 220) : '[no text]'}`;
  });
  return window.join('\n\n');
}
