import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  beautifyJson,
  clearLocalStorage,
  clearSessionStorage,
  deleteLocalStorageItem,
  deleteSessionStorageItem,
  formatStorageSummary,
  getCookies,
  getLocalStorage,
  getSessionStorage,
  getStorageData,
  setLocalStorageItem,
  setSessionStorageItem,
} from './storage.js';

describe('localStorage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('getLocalStorage returns empty array when empty', () => {
    const items = getLocalStorage();
    expect(items).toEqual([]);
  });

  it('getLocalStorage returns items with metadata', () => {
    localStorage.setItem('testKey', 'testValue');
    const items = getLocalStorage();

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('testKey');
    expect(items[0].value).toBe('testValue');
    expect(items[0].isParseable).toBe(false);
    expect(items[0].size).toBeGreaterThan(0);
  });

  it('getLocalStorage parses JSON values', () => {
    localStorage.setItem('jsonKey', JSON.stringify({ foo: 'bar' }));
    const items = getLocalStorage();

    expect(items[0].isParseable).toBe(true);
    expect(items[0].parsedValue).toEqual({ foo: 'bar' });
  });

  it('setLocalStorageItem sets a value', () => {
    setLocalStorageItem('newKey', 'newValue');
    expect(localStorage.getItem('newKey')).toBe('newValue');
  });

  it('deleteLocalStorageItem removes a value', () => {
    localStorage.setItem('toDelete', 'value');
    deleteLocalStorageItem('toDelete');
    expect(localStorage.getItem('toDelete')).toBeNull();
  });

  it('clearLocalStorage removes all items', () => {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');
    clearLocalStorage();
    expect(localStorage.length).toBe(0);
  });

  it('sorts items by key', () => {
    localStorage.setItem('zebra', '1');
    localStorage.setItem('apple', '2');
    localStorage.setItem('mango', '3');
    const items = getLocalStorage();

    expect(items[0].key).toBe('apple');
    expect(items[1].key).toBe('mango');
    expect(items[2].key).toBe('zebra');
  });
});

describe('sessionStorage utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('getSessionStorage returns empty array when empty', () => {
    const items = getSessionStorage();
    expect(items).toEqual([]);
  });

  it('getSessionStorage returns items with metadata', () => {
    sessionStorage.setItem('sessionKey', 'sessionValue');
    const items = getSessionStorage();

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('sessionKey');
    expect(items[0].value).toBe('sessionValue');
  });

  it('setSessionStorageItem sets a value', () => {
    setSessionStorageItem('newKey', 'newValue');
    expect(sessionStorage.getItem('newKey')).toBe('newValue');
  });

  it('deleteSessionStorageItem removes a value', () => {
    sessionStorage.setItem('toDelete', 'value');
    deleteSessionStorageItem('toDelete');
    expect(sessionStorage.getItem('toDelete')).toBeNull();
  });

  it('clearSessionStorage removes all items', () => {
    sessionStorage.setItem('key1', 'value1');
    sessionStorage.setItem('key2', 'value2');
    clearSessionStorage();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('cookie utilities', () => {
  it('getCookies returns array', () => {
    const cookies = getCookies();
    expect(Array.isArray(cookies)).toBe(true);
  });

  it('getCookies parses cookie string', () => {
    // Note: In jsdom, document.cookie may not work exactly like browsers
    // This test verifies the function doesn't throw
    const cookies = getCookies();
    expect(cookies).toBeDefined();
  });
});

describe('getStorageData', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns all storage data', () => {
    localStorage.setItem('localKey', 'localValue');
    sessionStorage.setItem('sessionKey', 'sessionValue');

    const data = getStorageData();

    expect(data.localStorage).toHaveLength(1);
    expect(data.sessionStorage).toHaveLength(1);
    expect(Array.isArray(data.cookies)).toBe(true);
  });
});

describe('formatStorageSummary', () => {
  it('returns "No storage data" when empty', () => {
    const summary = formatStorageSummary({
      localStorage: [],
      sessionStorage: [],
      cookies: [],
    });
    expect(summary).toBe('No storage data');
  });

  it('formats localStorage summary', () => {
    const summary = formatStorageSummary({
      localStorage: [{ key: 'k', value: 'v', isParseable: false, size: 100 }],
      sessionStorage: [],
      cookies: [],
    });
    expect(summary).toContain('localStorage: 1 items');
    expect(summary).toContain('100 B');
  });

  it('formats sessionStorage summary', () => {
    const summary = formatStorageSummary({
      localStorage: [],
      sessionStorage: [{ key: 'k', value: 'v', isParseable: false, size: 2048 }],
      cookies: [],
    });
    expect(summary).toContain('sessionStorage: 1 items');
    expect(summary).toContain('KB');
  });

  it('formats cookies summary', () => {
    const summary = formatStorageSummary({
      localStorage: [],
      sessionStorage: [],
      cookies: [{ name: 'c', value: 'v', size: 50 }],
    });
    expect(summary).toContain('cookies: 1');
  });
});

describe('beautifyJson', () => {
  it('beautifies valid JSON', () => {
    const input = '{"foo":"bar","baz":123}';
    const result = beautifyJson(input);
    expect(result).toContain('\n');
    expect(result).toContain('"foo": "bar"');
  });

  it('returns original string for invalid JSON', () => {
    const input = 'not json';
    const result = beautifyJson(input);
    expect(result).toBe('not json');
  });

  it('handles nested objects', () => {
    const input = '{"a":{"b":{"c":1}}}';
    const result = beautifyJson(input);
    expect(result).toContain('  ');
    expect(JSON.parse(result)).toEqual({ a: { b: { c: 1 } } });
  });
});
