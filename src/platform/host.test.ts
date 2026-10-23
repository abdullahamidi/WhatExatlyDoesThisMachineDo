import { describe, it, expect, afterEach } from 'vitest';
import { getHost } from './host';
import type { HostStorageBridge, WedtmdHost } from './host';

const fakeBridge = (): HostStorageBridge => ({
  loadAll: () => ({}),
  set: () => {},
  remove: () => {},
  flush: () => true,
});

const fakeHost = (): WedtmdHost => ({
  kind: 'electron',
  version: '0.0.0-test',
  platform: 'win32',
  isPackaged: false,
  storage: fakeBridge(),
  openExternal: () => {},
  quit: () => {},
  setFullscreen: () => {},
  isFullscreen: () => false,
  onFullscreenChange: () => () => {},
});

/** Calls getHost with a hostile scope value, bypassing the typed parameter. */
const hostileScope = (value: unknown): Parameters<typeof getHost>[0] => value as Parameters<typeof getHost>[0];

afterEach(() => {
  delete (globalThis as unknown as { wedtmdHost?: unknown }).wedtmdHost;
});

describe('getHost: no usable host', () => {
  it('returns null when the scope has no wedtmdHost', () => {
    expect(getHost({})).toBeNull();
  });

  it('returns null when wedtmdHost is undefined', () => {
    expect(getHost({ wedtmdHost: undefined })).toBeNull();
  });

  it('returns null for a host with the wrong kind', () => {
    expect(getHost({ wedtmdHost: { ...fakeHost(), kind: 'web' } })).toBeNull();
  });

  it('returns null for a number, a string or null', () => {
    expect(getHost({ wedtmdHost: 5 })).toBeNull();
    expect(getHost({ wedtmdHost: 'electron' })).toBeNull();
    expect(getHost({ wedtmdHost: null })).toBeNull();
  });

  it('returns null for a null or number scope without throwing', () => {
    expect(getHost(hostileScope(null))).toBeNull();
    expect(getHost(hostileScope(5))).toBeNull();
  });

  it('returns null when a getter on the scope throws', () => {
    const scope = {
      get wedtmdHost(): unknown {
        throw new Error('hostile');
      },
    };
    expect(getHost(scope)).toBeNull();
  });

  it('returns null when storage.flush is missing', () => {
    const host = fakeHost();
    const { flush: _flush, ...storage } = host.storage as unknown as Record<string, unknown>;
    expect(getHost({ wedtmdHost: { ...host, storage } })).toBeNull();
  });

  it('returns null when storage.loadAll is not a function', () => {
    const host = fakeHost();
    expect(getHost({ wedtmdHost: { ...host, storage: { ...host.storage, loadAll: 'nope' } } })).toBeNull();
  });

  it('returns null when storage is missing', () => {
    const host = fakeHost();
    const { storage: _storage, ...rest } = host;
    expect(getHost({ wedtmdHost: rest })).toBeNull();
  });

  it('returns null when quit is missing', () => {
    const host = fakeHost();
    const { quit: _quit, ...rest } = host;
    expect(getHost({ wedtmdHost: rest })).toBeNull();
  });

  it('returns null when openExternal or onFullscreenChange is not a function', () => {
    expect(getHost({ wedtmdHost: { ...fakeHost(), openExternal: 'x' } })).toBeNull();
    expect(getHost({ wedtmdHost: { ...fakeHost(), onFullscreenChange: undefined } })).toBeNull();
  });

  it('returns null when the host is a function rather than an object', () => {
    const fn = Object.assign(() => {}, fakeHost());
    expect(getHost({ wedtmdHost: fn })).toBeNull();
  });

  it('returns null with no argument in node (no window host on globalThis)', () => {
    expect(getHost()).toBeNull();
  });
});

describe('getHost: valid host', () => {
  it('returns the very same object that was found', () => {
    const host = fakeHost();
    expect(getHost({ wedtmdHost: host })).toBe(host);
  });

  it('accepts a host with extra fields', () => {
    const host = { ...fakeHost(), extra: 1 };
    expect(getHost({ wedtmdHost: host })).toBe(host);
  });

  it('reads globalThis when no scope is given', () => {
    const host = fakeHost();
    (globalThis as unknown as { wedtmdHost?: unknown }).wedtmdHost = host;
    expect(getHost()).toBe(host);
  });
});
