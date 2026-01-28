"use client";

import type { ConsultDetail as ConsultDetailType } from '../lib/types';

type Props = {
  consult: ConsultDetailType;
};

export function ConsultDetail({ consult }: Props) {
  return (
    <section className="flex-1 rounded-3xl border border-[#1c3b6b] bg-[rgba(7,12,24,0.85)] p-6 shadow-2xl">
      <header className="flex flex-wrap items-start gap-4 border-b border-[#1c3b6b] pb-4">
        <div>
          <p className="text-sm uppercase tracking-wider text-[var(--muted)]">Consult</p>
          <p className="text-2xl font-semibold">{consult.id}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-[var(--muted)]">Sender</p>
          <p className="text-lg">{consult.senderEmail ?? 'Unknown'}</p>
          <p className="text-xs text-[var(--muted)]">Received {new Date(consult.receivedAt).toLocaleString()}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl bg-[#111c2f] p-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--muted)]">Message Type</h3>
          <p className="mt-2 text-lg font-semibold text-[#38bdf8]">{consult.msgType.toUpperCase()}</p>
          <p className="mt-3 text-sm text-[var(--muted)]">Conv #{consult.convId} / Msg #{consult.msgId}</p>
        </article>
        <article className="rounded-2xl bg-[#111c2f] p-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--muted)]">AI Context Preview</h3>
          <p className="mt-2 leading-relaxed text-[15px]">{consult.snippet || 'No preview available.'}</p>
        </article>
      </div>

      <div className="mt-6 rounded-2xl bg-[#111c2f] p-4">
        <h3 className="text-sm uppercase tracking-wider text-[var(--muted)]">Full Message</h3>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{consult.payload.msgText || 'No text body received.'}</p>
      </div>

      {consult.payload.attachment && (
        <footer className="mt-6 rounded-2xl bg-[#111c2f] p-4 text-sm text-[var(--muted)]">
          <p className="uppercase tracking-wider">Attachment</p>
          <p>{consult.payload.attachment.fileName} ({Math.round(consult.payload.attachment.fileSize / 1024)} kB)</p>
        </footer>
      )}
    </section>
  );
}
