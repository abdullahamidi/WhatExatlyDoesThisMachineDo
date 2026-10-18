import { describe, it, expect } from 'vitest';
import { createNewCycleStub } from './newCycle';
import { FINALE_CHOICE } from '../data/finale';

describe('createNewCycleStub', () => {
  it('is blocked with the data reason', () => {
    const hook = createNewCycleStub();
    expect(hook.blockedReason()).toBe(FINALE_CHOICE.cycleStubReason);
    expect(hook.blockedReason()).toBe('Cycle 0043 is still calibrating.');
  });

  it('begin is a no-op: nothing throws, the block stays', () => {
    const hook = createNewCycleStub();
    expect(() => hook.begin()).not.toThrow();
    expect(() => hook.begin()).not.toThrow();
    expect(hook.blockedReason()).toBe(FINALE_CHOICE.cycleStubReason);
  });

  it('each call returns an independent hook with the same behaviour', () => {
    const a = createNewCycleStub();
    const b = createNewCycleStub();
    expect(a).not.toBe(b);
    expect(b.blockedReason()).toBe(a.blockedReason());
  });
});
