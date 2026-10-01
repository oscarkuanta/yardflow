import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { createQueryClient } from '../src/app/query-client.js';
import { routes } from '../src/app/routes.jsx';
import { ToastProvider } from '../src/components/Toasts.jsx';
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
    const handler = handlers[`${method} ${path}`] ?? handlers[`${method} ${path.split('?')[0]}`];
    if (!handler) {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found', details: [] } });
    }
    const body =
      options.headers?.['Content-Type'] === 'application/json'
        ? JSON.parse(options.body)
        : options.body;
    return handler(body, new URL(path, 'http://localhost'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function page(data, total = data.length) {
  return jsonResponse(200, { data, page: 1, pageSize: 25, total });
}

export function ok(data, status = 200) {
  return jsonResponse(status, { data });
}

export function apiError(status, code, message, details = []) {
  return jsonResponse(status, { error: { code, message, details } });
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
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...view, router };
}
