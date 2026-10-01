import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { createQueryClient } from '../src/app/query-client.js';
import { routes } from '../src/app/routes.jsx';
import { ThemeProvider } from '../src/hooks/useTheme.jsx';

export function jsonResponse(status, payload) {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function stubApi(handlers) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const path = url.replace('/api/v1', '');
    const handler = handlers[`${method} ${path}`];
    if (!handler) {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found', details: [] } });
    }
    return handler(options.body ? JSON.parse(options.body) : undefined);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const UNAUTHENTICATED = () =>
  jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in', details: [] } });

export function renderApp(initialEntry = '/') {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...view, router };
}
