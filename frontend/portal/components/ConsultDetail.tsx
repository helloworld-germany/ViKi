"use client";

import clsx from 'clsx';
import { useState } from 'react';
import type { ConsultDetail as ConsultDetailType, ConsultMessage } from '../lib/types';
import styles from './ConsultDetail.module.css';

type Props = {
  consult: ConsultDetailType;
};

export function ConsultDetail({ consult }: Props) {
  const [isThreadExpanded, setIsThreadExpanded] = useState(false);
  const thread = consult.thread.length ? consult.thread : [consult];
  const latest = thread[thread.length - 1];
  const messageTypeKey = (latest.payload.msgType ?? 'text').toLowerCase();
  const messageType = messageTypeKey.toUpperCase();
  const sender = latest.senderEmail ?? 'Unknown';
  const receivedAt = new Date(latest.receivedAt).toLocaleString();
  const messageText = latest.payload.msgText || 'No text body received.';
  const attachment = latest.payload.attachment;
  const contextPreview = buildContextPreview(thread);
  const contextSummary = contextPreview?.replace(/\n+/g, ' ').trim() || 'Not available yet.';
  const hasThread = thread.length > 1;
  const typeClass = styles[`type${messageTypeKey.charAt(0).toUpperCase()}${messageTypeKey.slice(1)}`] ?? styles.typeText;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Selected consult</p>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Consult {consult.id}</h2>
          <span className={clsx(styles.typeBadge, typeClass)}>{messageType}</span>
        </div>
        <dl className={styles.metaGrid}>
          <div className={styles.metaTile}>
            <dt className={styles.metaLabel}>Sender</dt>
            <dd className={styles.metaValue}>{sender}</dd>
          </div>
          <div className={styles.metaTile}>
            <dt className={styles.metaLabel}>Received</dt>
            <dd className={styles.metaValue}>{receivedAt}</dd>
          </div>
          <div className={styles.metaTile}>
            <dt className={styles.metaLabel}>Conversation</dt>
            <dd className={styles.metaValue}>
              #{consult.convId} · {thread.length} msg{thread.length === 1 ? '' : 's'}
            </dd>
          </div>
        </dl>
      </header>

      <div className={styles.summaryRow}>
        <article className={styles.summaryCard}>
          <p className={styles.cardTitle}>Message type</p>
          <p className={styles.cardValue}>{messageType}</p>
          <p className={styles.cardHint}>Latest message #{latest.msgId}</p>
        </article>
        <article className={clsx(styles.summaryCard, styles.aiCard)}>
          <p className={styles.cardTitle}>AI Context Preview</p>
          <p className={styles.aiCopy}>{contextSummary}</p>
        </article>
      </div>

      <article className={styles.messagePanel}>
        <p className={styles.cardTitle}>Full message</p>
        <p className={styles.messageBody}>{messageText}</p>
      </article>

      {attachment && (
        <div className={styles.attachment}>
          <p className={styles.cardTitle}>Attachment</p>
          <p className={styles.metaValue}>
            {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} kB)
          </p>
        </div>
      )}

      {hasThread && (
        <div className={styles.threadSection}>
          <div className={styles.threadHeader}>
            <p className={styles.threadTitle}>Conversation Thread ({thread.length})</p>
            <button type="button" className={styles.threadToggle} onClick={() => setIsThreadExpanded((prev) => !prev)}>
              {isThreadExpanded ? 'Hide details' : 'Show details'}
            </button>
          </div>
          {isThreadExpanded && (
            <ul className={styles.threadList}>
              {thread.map((message) => (
                <li key={message.id} className={styles.threadItem}>
                  <div className={styles.threadMeta}>
                    <span>
                      #{message.msgId} · {message.senderEmail ?? 'Unknown sender'}
                    </span>
                    <span>{new Date(message.receivedAt).toLocaleString()}</span>
                  </div>
                  <p className={styles.threadText}>{message.payload.msgText || 'No text body received.'}</p>
                  {message.payload.attachment && (
                    <p className={styles.threadMeta}>
                      Attachment: {message.payload.attachment.fileName} ({Math.round(message.payload.attachment.fileSize / 1024)} kB)
                    </p>
                  )}
                </li>
              ))}
            </ul>
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
