import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface SseEvent {
  data: string;
}

@Injectable()
export class SseService {
  private connections = new Map<string, Set<Subject<SseEvent>>>();

  addConnection(restaurantId: string): {
    stream:  Observable<SseEvent>;
    cleanup: () => void;
  } {
    const subject = new Subject<SseEvent>();

    if (!this.connections.has(restaurantId)) {
      this.connections.set(restaurantId, new Set());
    }
    this.connections.get(restaurantId)!.add(subject);

    const cleanup = () => {
      this.connections.get(restaurantId)?.delete(subject);
      if (this.connections.get(restaurantId)?.size === 0) {
        this.connections.delete(restaurantId);
      }
      subject.complete();
    };

    return { stream: subject.asObservable(), cleanup };
  }

  emit(restaurantId: string, event: string, data: unknown) {
    const subs = this.connections.get(restaurantId);
    if (!subs?.size) return;
    const msg: SseEvent = { data: JSON.stringify({ event, data }) };
    subs.forEach(s => s.next(msg));
  }
}
