import useSWR from 'swr';
import { API_BASE_URL } from './config';
import type { ConsultSummary, ConsultDetail } from './types';

const fetcher = async <T>(input: string): Promise<T> => {
  const res = await fetch(input);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
};

export function useConsults() {
  const { data, error, isLoading, mutate } = useSWR<ConsultSummary[]>(`${API_BASE_URL}/consults`, fetcher, {
    refreshInterval: 15_000
  });
  return {
    consults: data ?? [],
    isLoading,
    isError: Boolean(error),
    refresh: mutate
  };
}

export function useConsultDetail(id?: string) {
  const shouldFetch = Boolean(id);
  const { data, error, isLoading, mutate } = useSWR<ConsultDetail>(
    shouldFetch ? `${API_BASE_URL}/consults/${id}` : null,
    fetcher
  );
  return {
    consult: data,
    isLoading,
    isError: Boolean(error),
    refresh: mutate
  };
}
