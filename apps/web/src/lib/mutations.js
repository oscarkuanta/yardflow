import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toasts.jsx';

export function useApiMutation({ mutationFn, invalidate = [], successMessage, onSuccess }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (successMessage) {
        showToast(
          typeof successMessage === 'function' ? successMessage(data, variables) : successMessage,
        );
      }
      onSuccess?.(data, variables);
    },
  });
}

export async function dataOf(request) {
  const payload = await request;
  return payload?.data ?? null;
}
