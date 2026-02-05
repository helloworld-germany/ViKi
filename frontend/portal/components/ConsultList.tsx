"use client";

import clsx from 'clsx';
import type { ConsultSummary } from '../lib/types';

type Props = {
  consults: ConsultSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

export function ConsultList({ consults, selectedId, onSelect }: Props) {
  return (
    <nav
      aria-label="Available consults"
      className="flex w-full snap-x gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {consults.map((consult) => {
        const isActive = consult.id === selectedId;
        return (
          <button
            key={consult.id}
            type="button"
            aria-current={isActive}
            className={clsx(
              'min-w-[220px] snap-start rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8efc]',
              isActive
                ? 'border-[#6ea0ff] bg-gradient-to-r from-[#1f3c7a] to-[#0c1b3c] text-white shadow-[0_12px_30px_rgba(4,10,24,0.6)]'
                : 'border-transparent bg-[rgba(13,21,40,0.8)] text-white/80 hover:border-[#274b91]'
            )}
            onClick={() => onSelect(consult.id)}
          >
            <div className="text-[11px] uppercase tracking-[0.4em] text-[#7d8cb6]">
              Conv #{consult.convId} · {consult.messageCount}
            </div>
            <p className="mt-1 text-base font-semibold text-white">{consult.senderEmail ?? 'Unknown sender'}</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {consult.snippet?.trim() || 'Not available yet.'}
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#8da0d1]">
              <span>{formatDate(consult.receivedAt)}</span>
              <span className="rounded-full border border-[#344f8c] px-2 py-[2px] text-[10px] font-semibold text-[#9ab5ff]">
                {(consult.msgType ?? 'text').toUpperCase()}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
