"use client";

import clsx from 'clsx';
import type { ConsultSummary } from '../lib/types';

type Props = {
  consults: ConsultSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function ConsultList({ consults, selectedId, onSelect }: Props) {
  return (
    <aside className="w-full lg:w-80 space-y-3">
      {consults.map((consult) => (
        <button
          key={consult.id}
          type="button"
          className={clsx(
            'w-full text-left rounded-2xl border px-4 py-3 transition focus:outline-none',
            selectedId === consult.id
              ? 'bg-[#142748] border-[#1c3b6b] shadow-lg'
              : 'bg-[rgba(16,26,49,0.6)] border-transparent hover:border-[#1c3b6b]'
          )}
          onClick={() => onSelect(consult.id)}
        >
          <div className="text-xs uppercase tracking-widest text-[var(--muted)]">
            {consult.msgType}
          </div>
          <div className="text-lg font-semibold">{consult.senderEmail ?? 'Unknown sender'}</div>
          <div className="text-sm text-[var(--muted)]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {consult.snippet || 'No preview available.'}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
            <span>{new Date(consult.receivedAt).toLocaleString()}</span>
            <span className="text-[#38bdf8]">{consult.msgType.toUpperCase()}</span>
          </div>
        </button>
      ))}
    </aside>
  );
}
