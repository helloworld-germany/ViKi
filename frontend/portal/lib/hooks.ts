import useSWR from 'swr';
import { API_BASE_URL } from './config';
import { apiFetch } from './api';
import type { ConsultSummary, ConsultDetail } from './types';

export function useConsults() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ConsultSummary[]>(
    `${API_BASE_URL}/consults`,
    (url) => apiFetch<ConsultSummary[]>(url),
    {
      refreshInterval: 15_000,
      revalidateOnFocus: false
    }
  );
  return {
    consults: data ?? [],
    isLoading,
    isRefreshing: isValidating,
    isError: Boolean(error),
    errorMessage: error?.message ?? '',
    refresh: mutate
  };
}

export function useConsultDetail(id?: string) {
  const shouldFetch = Boolean(id);
  const { data, error, isLoading, mutate } = useSWR<ConsultDetail>(
    shouldFetch ? `${API_BASE_URL}/consults/${id}` : null,
    (url) => apiFetch<ConsultDetail>(url),
    {
      revalidateOnFocus: false
    }
  );
  return {
    consult: data,
    isLoading,
    isError: Boolean(error),
    errorMessage: error?.message ?? '',
    refresh: mutate
  };
}
