"use client";

import clsx from 'clsx';
import type { ConsultSummary } from '../lib/types';
import styles from './ConsultList.module.css';

type Props = {
  consults: ConsultSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

export function ConsultList({ consults, selectedId, onSelect }: Props) {
  return (
    <div className={styles.scrollArea} aria-label="Available consults">
      <ul className={styles.list} role="list">
        {consults.map((consult) => {
          const isActive = consult.id === selectedId;
          const typeKey = (consult.msgType ?? 'text').toLowerCase();
          const typeClass = styles[`type${typeKey.charAt(0).toUpperCase()}${typeKey.slice(1)}`] ?? styles.typeText;
          return (
            <li key={consult.id}>
              <button
                type="button"
                aria-current={isActive}
                className={clsx(styles.itemButton, isActive && styles.itemActive)}
                onClick={() => onSelect(consult.id)}
              >
                <div className={styles.metaRow}>
                  <span>Conv #{consult.convId}</span>
                  <span className={styles.countPill}>
                    {consult.messageCount} msg{consult.messageCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className={styles.sender}>{consult.senderEmail ?? 'Unknown sender'}</p>
                <p className={styles.snippet}>{consult.snippet?.trim() || 'Not available yet.'}</p>
                <div className={styles.footerRow}>
                  <span>{formatDate(consult.receivedAt)}</span>
                  <span className={clsx(styles.typePill, typeClass)}>{(consult.msgType ?? 'text').toUpperCase()}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
