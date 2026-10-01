import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api.js';

const MAX_RETRIES = 2;

export function shouldRetry(failureCount, error) {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_RETRIES;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
