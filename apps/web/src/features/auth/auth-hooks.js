import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CURRENT_USER_KEY, fetchCurrentUser, logIn, logOut } from './auth-api.js';

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });
}

export function useLogIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, user);
    },
  });
}

export function useLogOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logOut,
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
    },
  });
}
