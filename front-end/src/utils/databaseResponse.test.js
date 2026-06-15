/**
 * Tests for utils/databaseResponse.js
 *
 * Covers all supported backend response field name variants and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { getSelectedDatabase, getIsConnected } from './databaseResponse';

describe('getSelectedDatabase', () => {
  it('returns null for null/undefined input', () => {
    expect(getSelectedDatabase(null)).toBeNull();
    expect(getSelectedDatabase(undefined)).toBeNull();
    expect(getSelectedDatabase()).toBeNull();
  });

  it('prefers selected_database', () => {
    expect(getSelectedDatabase({ selected_database: 'mydb', current_database: 'other' })).toBe('mydb');
  });

  it('falls back to current_database', () => {
    expect(getSelectedDatabase({ current_database: 'mydb' })).toBe('mydb');
  });

  it('falls back to database', () => {
    expect(getSelectedDatabase({ database: 'mydb' })).toBe('mydb');
  });

  it('falls back to db_config.database', () => {
    expect(getSelectedDatabase({ db_config: { database: 'mydb' } })).toBe('mydb');
  });

  it('returns null when no known field is present', () => {
    expect(getSelectedDatabase({ db_type: 'postgresql' })).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(getSelectedDatabase({})).toBeNull();
  });

  it('passes empty string through since ?? only skips null/undefined', () => {
    // The ?? operator does NOT coerce empty string to null.
    // An empty selected_database field is returned as-is.
    expect(getSelectedDatabase({ selected_database: '' })).toBe('');
  });
});

describe('getIsConnected', () => {
  it('returns false for null input', () => {
    expect(getIsConnected(null)).toBe(false);
  });

  it('uses connected boolean when present', () => {
    expect(getIsConnected({ connected: true })).toBe(true);
    expect(getIsConnected({ connected: false, selected_database: 'db' })).toBe(false);
  });

  it('infers connected state from database name when no connected field', () => {
    expect(getIsConnected({ selected_database: 'mydb' })).toBe(true);
    expect(getIsConnected({ current_database: 'other' })).toBe(true);
    expect(getIsConnected({ db_type: 'postgresql' })).toBe(false);
  });
});
