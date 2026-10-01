import { ApiError, apiRequest } from '../../lib/api.js';

export const CURRENT_USER_KEY = ['auth', 'me'];

export const DEMO_PASSWORD = 'demo1234';

export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', label: 'Admin', name: 'Anna Keller', email: 'admin@yardflow.dev' },
  { role: 'PLANNER', label: 'Planner', name: 'Mira Pohl', email: 'planner@yardflow.dev' },
  {
    role: 'GATE_OPERATOR',
    label: 'Gate operator',
    name: 'Jonas Reuter',
    email: 'gate@yardflow.dev',
  },
  { role: 'CUSTOMER', label: 'Customer', name: 'Lea Hansen', email: 'ops@hansenorth.example' },
];

export const STAFF_ROLES = ['ADMIN', 'PLANNER', 'GATE_OPERATOR'];

export function homePathFor(role) {
  return role === 'CUSTOMER' ? '/portal' : '/app';
}

export async function fetchCurrentUser() {
  try {
    const { data } = await apiRequest('/auth/me');
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function logIn(credentials) {
  const { data } = await apiRequest('/auth/login', { method: 'POST', body: credentials });
  return data;
}

export function logOut() {
  return apiRequest('/auth/logout', { method: 'POST' });
}
