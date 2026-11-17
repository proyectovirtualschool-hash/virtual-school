interface PendingRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export class TrocrClient {
  private worker: Worker | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private readyPromise: Promise<void> | null = null;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../../workers/trocr.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent) => {
      const { id, ok, text, error } = event.data || {};
      const request = this.pending.get(id);
      if (!request) return;
      this.pending.delete(id);
      if (ok) request.resolve(text || '');
      else request.reject(new Error(error || 'Error de TrOCR'));
    };
    worker.onerror = (event) => {
      this.pending.forEach((request) => request.reject(new Error(event.message || 'Error en el worker de TrOCR')));
      this.pending.clear();
      this.worker = null;
      this.readyPromise = null;
    };
    this.worker = worker;
    return worker;
  }

  private request<T extends string>(type: 'warmup' | 'recognize', image?: string): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (text: string) => void, reject });
      worker.postMessage({ id, type, image });
    });
  }

  public async warmup(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.request<string>('warmup').then(() => undefined);
    }
    return this.readyPromise;
  }

  public async recognize(image: string): Promise<string> {
    await this.warmup();
    return this.request<string>('recognize', image);
  }

  public terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.pending.forEach((request) => request.reject(new Error('TrOCR finalizado')));
    this.pending.clear();
  }
}

export const trocrClient = new TrocrClient();
