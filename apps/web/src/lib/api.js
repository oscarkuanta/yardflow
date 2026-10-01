export const API_BASE = '/api/v1';

const UNEXPECTED_ANSWER = {
  code: 'UNEXPECTED_ANSWER',
  message: 'The server did not answer as expected, please try again',
  details: [],
};

const NETWORK_FAILURE = {
  code: 'NETWORK_ERROR',
  message: 'Cannot reach YardFlow, check your connection and try again',
  details: [],
};

export class ApiError extends Error {
  constructor(status, { code, message, details = [] }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestPayload(body, text, contentType) {
  if (text !== undefined) {
    return { headers: { 'Content-Type': contentType }, body: text };
  }
  if (body !== undefined) {
    return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
  return { headers: {}, body: undefined };
}

export function queryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (entries.length === 0) {
    return '';
  }
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}`;
}

export async function apiRequest(
  path,
  { method = 'GET', body, text, contentType = 'text/plain', signal } = {},
) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      ...requestPayload(body, text, contentType),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, NETWORK_FAILURE);
  }
  if (response.status === 204) {
    return null;
  }
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? UNEXPECTED_ANSWER);
  }
  return payload;
}

export function fieldErrors(error) {
  if (!(error instanceof ApiError)) {
    return {};
  }
  return Object.fromEntries(
    error.details
      .filter((detail) => detail.field)
      .map((detail) => [detail.field.replace(/^(body|query|params)\./, ''), detail.message]),
  );
}
