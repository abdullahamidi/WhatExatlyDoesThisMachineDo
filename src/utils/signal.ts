export interface Signal<T = void> { emit(value: T): void; on(fn: (value: T) => void): () => void }

// Minimal typed event channel. Each `on` call wraps the listener in a fresh closure so the same
// function can be subscribed twice and each subscription unsubscribes independently.
export function createSignal<T = void>(): Signal<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    emit(value: T): void {
      for (const listener of Array.from(listeners)) {
        try {
          listener(value);
        } catch (error) {
          console.error('[signal] listener threw', error);
        }
      }
    },
    on(fn: (value: T) => void): () => void {
      const wrapped = (value: T): void => fn(value);
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
  };
}
