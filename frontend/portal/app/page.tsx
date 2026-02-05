"use client";

import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { ConsultList } from '../components/ConsultList';
import { ConsultDetail } from '../components/ConsultDetail';
import { VoiceConsole } from '../components/VoiceConsole';
import { useConsultDetail, useConsults } from '../lib/hooks';
import styles from './page.module.css';

export default function Home() {
  const {
    consults,
    isLoading: listLoading,
    isError: listError,
    errorMessage: listErrorMessage,
    refresh: refreshConsults,
    isRefreshing
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

  const stats = useMemo(() => {
    const totalMessages = consults.reduce((sum, item) => sum + (item.messageCount ?? 0), 0);
    const lastUpdated = consults.length ? new Date(consults[0].receivedAt).toLocaleString() : 'Waiting for first payload';
    return [
      {
        label: 'Active threads',
        value: consults.length ? consults.length.toString() : '—',
        hint: 'Distinct NetSfere conversations'
      },
      {
        label: 'Messages synced',
        value: totalMessages ? totalMessages.toString() : '—',
        hint: 'Running count across threads'
      },
      {
        label: 'Last ingest',
        value: lastUpdated,
        hint: consults.length ? 'Synced via webhook' : 'Trigger a webhook to begin'
      }
    ];
  }, [consults]);

  const syncLabel = listError ? 'Sync failed' : isRefreshing || listLoading ? 'Syncing latest data' : 'Up to date';
  const syncStyle = listError ? styles.syncStatusError : isRefreshing || listLoading ? styles.syncStatusLive : styles.syncStatusReady;

  return (
    <main className={styles.pageShell}>
      <header className={styles.hero}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Consults</p>
            <h1 className={styles.heroTitle}>Realtime Inbox</h1>
            <p className={styles.heroDescription}>
              Observe the freshest NetSfere activity, triage open threads, and drop into a conversation in seconds.
            </p>
          </div>
          <div className={styles.commandBar}>
            <span className={clsx(styles.syncStatus, syncStyle)}>{syncLabel}</span>
            <button type="button" onClick={() => refreshConsults()} disabled={isRefreshing} className={styles.refreshButton}>
              {isRefreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </div>
        {listError && (
          <p className={styles.errorInline}>
            Unable to load consults{listErrorMessage ? `: ${listErrorMessage}` : '.'}
          </p>
        )}
        <div className={styles.statsRow}>
          {stats.map((stat) => (
            <article key={stat.label} className={styles.statCard}>
              <p className={styles.statLabel}>{stat.label}</p>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statHint}>{stat.hint}</p>
            </article>
          ))}
        </div>
      </header>

      <section className={styles.contentGrid}>
        <div className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Active conversations</h2>
            <p className={styles.panelHint}>Sorted by the most recent NetSfere activity.</p>
          </div>
          <div className={styles.listBody}>
            {listLoading && consults.length === 0 ? (
              <div className={styles.stateCard}>Loading consults…</div>
            ) : emptyState ? (
              <div className={styles.stateCard}>Trigger the NetSfere webhook or run the pull endpoint to seed data.</div>
            ) : (
              <ConsultList consults={consults} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </div>

        <div className={styles.detailStack}>
          <VoiceConsole consultId={selectedId} />
          {detailError && (
            <div className={styles.errorBanner}>
              Unable to load consult detail{detailErrorMessage ? `: ${detailErrorMessage}` : '.'}
            </div>
          )}
          {showDetail && consult ? (
            <ConsultDetail consult={consult} />
          ) : (
            <div className={styles.placeholder}>
              {detailLoading ? 'Loading consult…' : 'Select a consult to begin.'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
