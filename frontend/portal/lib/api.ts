import { API_BASE_URL } from './config';
import type { ConsultDetail, ConsultSummary } from './types';

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {})
    },
    cache: init?.cache ?? 'no-store'
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchConsultSummaries() {
  return apiFetch<ConsultSummary[]>(`${API_BASE_URL}/consults`);
}

export function fetchConsultDetail(id: string) {
  return apiFetch<ConsultDetail>(`${API_BASE_URL}/consults/${id}`);
}
