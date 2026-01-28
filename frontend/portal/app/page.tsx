"use client";

import { useEffect, useState } from 'react';
import { ConsultList } from '../components/ConsultList';
import { ConsultDetail } from '../components/ConsultDetail';
import { VoiceConsole } from '../components/VoiceConsole';
import { useConsultDetail, useConsults } from '../lib/hooks';

export default function Home() {
  const { consults, isLoading: listLoading, isError: listError } = useConsults();
  const [selectedId, setSelectedId] = useState<string>('');
  const { consult, isLoading: detailLoading } = useConsultDetail(selectedId);

  useEffect(() => {
    if (!selectedId && consults.length > 0) {
      setSelectedId(consults[0].id);
    }
  }, [consults, selectedId]);

  const showDetail = Boolean(consult && !detailLoading);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 lg:flex-row">
      <section className="w-full lg:w-80">
        {listError && <p className="text-sm text-red-400">Unable to load consults.</p>}
        {listLoading && consults.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Loading consults…</p>
        ) : (
          <ConsultList consults={consults} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </section>
      <div className="flex flex-1 flex-col gap-6">
        {showDetail && consult ? (
          <ConsultDetail consult={consult} />
        ) : (
          <div className="flex-1 rounded-3xl border border-dashed border-[#1c3b6b] p-6 text-sm text-[var(--muted)]">
            {detailLoading ? 'Loading consult…' : 'Select a consult to begin.'}
          </div>
        )}
        <VoiceConsole consultId={selectedId} />
      </div>
    </main>
  );
}
