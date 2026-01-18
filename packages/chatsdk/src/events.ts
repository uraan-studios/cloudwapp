export type Listener = (...args: any[]) => void;

export class EventEmitter<Events extends Record<string, Listener>> {
  private listeners: Map<keyof Events, Set<Listener>> = new Map();

  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Events[K]): this {
    const onceListener = ((...args: any[]) => {
      this.off(event, onceListener as Events[K]);
      listener(...args);
    }) as Events[K];
    return this.on(event, onceListener);
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners && eventListeners.size > 0) {
      eventListeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in listener for event "${String(event)}":`, error);
        }
      });
      return true;
    }
    return false;
  }

  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }
}
