// Shared modal stack (WP4). Pure: no DOM globals. The Esc listener is bound
// once by bootstrap through `bindEscapeToStack`, which only needs an event target.

export interface ModalStack {
  /** Adds a dialog on top (an existing id is moved to the top and its close fn replaced). Returns an idempotent remover. */
  push(id: string, close: () => void): () => void;
  /** Removes without calling close. No-op when absent. */
  remove(id: string): void;
  has(id: string): boolean;
  isOpen(): boolean; // size() > 0
  size(): number;
  topId(): string | null;
  /** Calls close() of the TOP entry only (try/catch -> console.error), then removes that entry if it is still on the stack. Returns false when empty. */
  closeTop(): boolean;
  /** Fires only when isOpen() flips. Returns unsubscribe. */
  onChange(fn: (open: boolean) => void): () => void;
}

interface ModalEntry {
  id: string;
  close: () => void;
}

export function createModalStack(): ModalStack {
  let entries: ModalEntry[] = [];
  const listeners = new Set<(open: boolean) => void>();

  // Runs a mutation and notifies listeners only when the open state flipped.
  const mutate = (change: () => void): void => {
    const before = entries.length > 0;
    change();
    const after = entries.length > 0;
    if (before === after) return;
    for (const fn of [...listeners]) {
      try {
        fn(after);
      } catch (err) {
        console.error('modal listener failed', err);
      }
    }
  };

  const removeEntry = (target: ModalEntry): void => {
    mutate(() => {
      entries = entries.filter((e) => e !== target);
    });
  };

  return {
    push(id, close) {
      let entry: ModalEntry = { id, close };
      mutate(() => {
        entries = entries.filter((e) => e.id !== id);
        entry = { id, close };
        entries.push(entry);
      });
      // Remover targets this exact entry: a stale remover never removes a re-pushed id.
      const pushed = entry;
      return () => {
        if (entries.includes(pushed)) removeEntry(pushed);
      };
    },
    remove(id) {
      if (!entries.some((e) => e.id === id)) return;
      mutate(() => {
        entries = entries.filter((e) => e.id !== id);
      });
    },
    has(id) {
      return entries.some((e) => e.id === id);
    },
    isOpen() {
      return entries.length > 0;
    },
    size() {
      return entries.length;
    },
    topId() {
      const top = entries[entries.length - 1];
      return top ? top.id : null;
    },
    closeTop() {
      const top = entries[entries.length - 1];
      if (!top) return false;
      try {
        top.close();
      } catch (err) {
        console.error(`modal "${top.id}" close failed`, err);
      }
      if (entries.includes(top)) removeEntry(top);
      return true;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export interface EscapeEventLike {
  key: string;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface EscapeTarget {
  addEventListener(type: 'keydown', listener: (e: EscapeEventLike) => void, capture?: boolean): void;
  removeEventListener(type: 'keydown', listener: (e: EscapeEventLike) => void, capture?: boolean): void;
}

/** One capture-phase keydown listener: Escape while stack.isOpen() -> preventDefault + stopPropagation + closeTop(). Returns the disposer. */
export function bindEscapeToStack(stack: ModalStack, target: EscapeTarget): () => void {
  const listener = (e: EscapeEventLike): void => {
    if (e.key === 'Escape' && stack.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      stack.closeTop();
    }
  };
  target.addEventListener('keydown', listener, true);
  return () => {
    target.removeEventListener('keydown', listener, true);
  };
}
