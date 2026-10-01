import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toasts.jsx';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { createQueryClient } from './query-client.js';
import { routes } from './routes.jsx';

const router = createBrowserRouter(routes);

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
