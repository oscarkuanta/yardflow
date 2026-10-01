import { describe, expect, it, vi } from 'vitest';
import { shouldRetry } from '../src/app/query-client.js';
import { STAFF_ROLES, homePathFor } from '../src/features/auth/auth-api.js';
import { statCardsFrom } from '../src/features/landing/StatCards.jsx';
import { ApiError, apiRequest, fieldErrors } from '../src/lib/api.js';
import { formatClock, formatDecimal, formatNumber, initialsOf } from '../src/lib/format.js';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemTheme,
  watchSystemTheme,
} from '../src/lib/theme.js';
import { greetingFor } from '../src/routes/portal/PortalShell.jsx';
import { navigationFor } from '../src/routes/staff/staff-navigation.js';
import { jsonResponse } from './render-app.jsx';

describe('api client', () => {
  it('sends JSON with the session cookie and returns the payload', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: { id: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = await apiRequest('/things', { method: 'POST', body: { name: 'A' } });
    expect(payload).toEqual({ data: { id: 1 } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/things');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe('{"name":"A"}');
  });

  it('returns null for 204 answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });

  it('turns the API error envelope into an ApiError', async () => {
    const error = { code: 'CONFLICT', message: 'Slot taken', details: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(409, { error })),
    );
    await expect(apiRequest('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'CONFLICT',
      message: 'Slot taken',
    });
  });

  it('uses a fallback error when the answer is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 502 })),
    );
    await expect(apiRequest('/x')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_ANSWER',
    });
  });

  it('reports a network error when the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('passes an abort through unchanged', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(abort)),
    );
    await expect(apiRequest('/x')).rejects.toBe(abort);
  });

  it('maps validation details to form field errors', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: [
        { field: 'body.email', message: 'Invalid email' },
        { field: 'query.page', message: 'Too small' },
        { message: 'No field' },
      ],
    });
    expect(fieldErrors(error)).toEqual({ email: 'Invalid email', page: 'Too small' });
    expect(fieldErrors(new Error('plain'))).toEqual({});
    expect(fieldErrors(null)).toEqual({});
  });
});

describe('theme', () => {
  it('reads only known stored themes', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(readStoredTheme()).toBe('light');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'pink');
    expect(readStoredTheme()).toBeNull();
  });

  it('survives storage that throws', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredTheme(blockedStorage)).toBeNull();
    expect(() => storeTheme('dark', blockedStorage)).not.toThrow();
  });

  it('stores the chosen theme', () => {
    storeTheme('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('follows the system until the user picks a theme', () => {
    expect(systemTheme(() => ({ matches: true }))).toBe('light');
    expect(systemTheme(() => ({ matches: false }))).toBe('dark');
    expect(resolveTheme({ stored: null, system: 'light' })).toBe('light');
    expect(resolveTheme({ stored: 'dark', system: 'light' })).toBe('dark');
  });

  it('applies the theme to the root element', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reports system theme changes and stops on cleanup', () => {
    const query = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange, () => query);
    const listener = query.addEventListener.mock.calls[0][1];
    listener({ matches: true });
    listener({ matches: false });
    expect(onChange.mock.calls).toEqual([['light'], ['dark']]);
    stop();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', listener);
    expect(watchSystemTheme(onChange, () => ({}))).toBeTypeOf('function');
  });
});

describe('formatting', () => {
  it('shows a dash for missing numbers', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatDecimal(undefined)).toBe('—');
    expect(formatDecimal(6.6667)).toBe('6.7');
  });

  it('shows clock times in terminal time', () => {
    expect(formatClock('2026-07-01T10:05:00Z')).toBe('12:05');
    expect(formatClock('2026-01-15T10:05:00Z')).toBe('11:05');
  });

  it('builds initials from the first two names', () => {
    expect(initialsOf('Anna Keller')).toBe('AK');
    expect(initialsOf('jonas  van reuter')).toBe('JV');
  });
});

describe('roles and navigation', () => {
  it('sends customers to the portal and staff to the app', () => {
    expect(homePathFor('CUSTOMER')).toBe('/portal');
    STAFF_ROLES.forEach((role) => expect(homePathFor(role)).toBe('/app'));
  });

  it('shows each staff role only its own screens', () => {
    const labels = (role) => navigationFor(role).map((item) => item.label);
    expect(labels('ADMIN')).toEqual([
      'Yard',
      'Gate',
      'Vessels',
      'Work orders',
      'Customs',
      'Reports',
      'Admin',
    ]);
    expect(labels('PLANNER')).toEqual(['Yard', 'Vessels', 'Work orders', 'Reports']);
    expect(labels('GATE_OPERATOR')).toEqual(['Yard', 'Gate']);
    expect(labels('CUSTOMER')).toEqual([]);
  });

  it('greets by the time of day in Berlin', () => {
    expect(greetingFor(new Date('2026-07-01T06:00:00Z'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-07-01T12:00:00Z'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-07-01T17:00:00Z'))).toBe('Good evening');
  });
});

describe('query retries', () => {
  it('never retries client errors and retries other failures twice', () => {
    const clientError = new ApiError(404, { code: 'NOT_FOUND', message: 'x' });
    const serverError = new ApiError(500, { code: 'INTERNAL', message: 'x' });
    expect(shouldRetry(0, clientError)).toBe(false);
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, new Error('offline'))).toBe(true);
    expect(shouldRetry(2, serverError)).toBe(false);
  });
});

describe('landing stat cards', () => {
  it('formats the public numbers and keeps a dash for missing gate-in time', () => {
    const cards = statCardsFrom({
      occupancyPercent: 65,
      gateMovesToday: 41,
      averageDwellDays: 6.66,
      averageGateInMinutes: null,
    });
    expect(cards.map((card) => card.value)).toEqual(['65.0', '41', '6.7', '—']);
  });
});
