/**
 * Shared fetch wrapper for API requests.
 * @module api/client
 */

const IS_DEV = import.meta.env.DEV;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

import logger from '@/utils/logger';

/** API error with HTTP status and optional response payload. */
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function csrfHeaders(method) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return {};
  }

  const token = readCookie(CSRF_COOKIE_NAME);
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}

/**
 * Base fetch wrapper with consistent error handling.
 * 
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {ApiError} On non-2xx responses
 */
async function apiClient(endpoint, options = {}) {
  const method = options.method || 'GET';
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(method),
      ...options.headers,
    },
  };

  if (IS_DEV) {
    logger.api(method, endpoint);
  }

  try {
    const response = await fetch(endpoint, config);

    const contentType = response.headers.get('content-type');
    if (response.status === 204) {
      if (!response.ok) {
        throw new ApiError(
          `Request failed: ${response.statusText}`,
          response.status
        );
      }
      return null;
    }

    if (contentType && !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new ApiError(
          `Request failed: ${response.statusText}`,
          response.status
        );
      }
      return response;
    }

    if (!contentType) {
      if (!response.ok) {
        throw new ApiError(
          `Request failed: ${response.statusText}`,
          response.status
        );
      }
      return response;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || `Request failed: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      error.message || 'Network error',
      0,
      null
    );
  }
}

/** GET wrapper. */
export function get(endpoint, options = {}) {
  return apiClient(endpoint, { ...options, method: 'GET' });
}

/** POST wrapper. */
export function post(endpoint, body, options = {}) {
  return apiClient(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** PATCH wrapper. */
export function patch(endpoint, body, options = {}) {
  return apiClient(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** DELETE wrapper. */
export function del(endpoint, options = {}) {
  return apiClient(endpoint, { ...options, method: 'DELETE' });
}

/** POST wrapper that returns raw Response (for streaming). */
export async function postRaw(endpoint, body, options = {}) {
  const config = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders('POST'),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  };

  if (IS_DEV) {
    logger.api('POST (raw)', endpoint);
  }

  try {
    const response = await fetch(endpoint, config);

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(
        text || `Request failed: ${response.statusText}`,
        response.status
      );
    }
  
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      error.message || 'Network error',
      0,
      null
    );
  }
}
