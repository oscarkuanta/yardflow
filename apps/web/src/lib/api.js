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

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const hasBody = body !== undefined;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(body) : undefined,
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
