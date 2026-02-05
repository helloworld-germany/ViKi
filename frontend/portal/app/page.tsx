"use client";

import { useEffect, useState } from 'react';
import { ConsultList } from '../components/ConsultList';
import { ConsultDetail } from '../components/ConsultDetail';
import { VoiceConsole } from '../components/VoiceConsole';
import { useConsultDetail, useConsults } from '../lib/hooks';

export default function Home() {
  const {
    consults,
    isLoading: listLoading,
    isError: listError,
    errorMessage: listErrorMessage
  } = useConsults();
  const [selectedId, setSelectedId] = useState<string>('');
  const {
    consult,
    isLoading: detailLoading,
    isError: detailError,
    errorMessage: detailErrorMessage
  } = useConsultDetail(selectedId);

  useEffect(() => {
    if (!selectedId && consults.length > 0) {
      setSelectedId(consults[0].id);
    }
  }, [consults, selectedId]);

  const showDetail = Boolean(consult && !detailLoading);
  const emptyState = !listLoading && consults.length === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Consults</p>
          <h1 className="text-3xl font-semibold text-white">Realtime Inbox</h1>
          <p className="text-sm text-[var(--muted)]">Latest NetSfere consults grouped by conversation.</p>
        </div>
        {listError && (
          <p className="text-sm text-red-400">
            Unable to load consults{listErrorMessage ? `: ${listErrorMessage}` : '.'}
          </p>
        )}
        {listLoading && consults.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Loading consults…</p>
        ) : emptyState ? (
          <p className="rounded-2xl border border-dashed border-[#1c3b6b] px-4 py-6 text-sm text-[var(--muted)]">
            No consults have been ingested yet. Trigger the NetSfere webhook or use the pull endpoint to seed one.
          </p>
        ) : (
          <ConsultList consults={consults} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </header>
      <VoiceConsole consultId={selectedId} />
      <div className="flex flex-1 flex-col gap-4">
        {detailError && (
          <p className="rounded-2xl border border-[#3f1f1f] bg-[rgba(63,31,31,0.4)] px-4 py-3 text-sm text-red-300">
            Unable to load consult detail{detailErrorMessage ? `: ${detailErrorMessage}` : '.'}
          </p>
        )}
        {showDetail && consult ? (
          <ConsultDetail consult={consult} />
        ) : (
          <div className="flex-1 rounded-3xl border border-dashed border-[#1c3b6b] p-6 text-sm text-[var(--muted)]">
            {detailLoading ? 'Loading consult…' : 'Select a consult to begin.'}
          </div>
        )}
      </div>
    </main>
  );
}
