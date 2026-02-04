/**
 * WAAudio Markers - 标记点管理器
 */

export interface Marker {
  id: string;
  name: string;
  time: number;
  color: string;
  type: string;
}

export type MarkerType = 'marker' | 'bookmark' | 'loop-start' | 'loop-end' | 'in' | 'out';

export interface MarkerRegion {
  start: Marker;
  end?: Marker;
}

export class WAAudioMarkers {
  private markers: Map<string, Marker> = new Map();
  private ordered: Marker[] = [];
  private duration: number;
  private onChange: (() => void) | null = null;
  private colors: Record<string, string> = {
    'marker': '#4ECDC4',
    'bookmark': '#FFEAA7',
    'loop-start': '#FF6B6B',
    'loop-end': '#FF6B6B',
    'in': '#45B7D1',
    'out': '#45B7D1'
  };
  
  constructor(duration: number = 0) {
    this.duration = duration;
  }
  
  get all(): Marker[] {
    return [...this.ordered];
  }
  
  get count(): number {
    return this.markers.size;
  }
  
  add(name: string, time: number, type: string = 'marker'): string {
    const id = `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const marker: Marker = {
      id,
      name,
      time: Math.max(0, Math.min(time, this.duration)),
      color: this.colors[type] || '#4ECDC4',
      type
    };
    this.markers.set(id, marker);
    this.ordered = Array.from(this.markers.values()).sort((a, b) => a.time - b.time);
    this.onChange?.();
    return id;
  }
  
  remove(id: string): boolean {
    const deleted = this.markers.delete(id);
    if (deleted) {
      this.ordered = Array.from(this.markers.values()).sort((a, b) => a.time - b.time);
      this.onChange?.();
    }
    return deleted;
  }
  
  get(id: string): Marker | undefined {
    return this.markers.get(id);
  }
  
  clear(): void {
    this.markers.clear();
    this.ordered = [];
    this.onChange?.();
  }
  
  setIn(time: number): string {
    const old = this.ordered.find(m => m.type === 'in');
    if (old) this.remove(old.id);
    return this.add('In', time, 'in');
  }
  
  setOut(time: number): string {
    const old = this.ordered.find(m => m.type === 'out');
    if (old) this.remove(old.id);
    return this.add('Out', time, 'out');
  }
  
  jumpToNext(current: number): number | null {
    const next = this.ordered.find(m => m.time > current);
    return next?.time ?? null;
  }
  
  jumpToPrev(current: number): number | null {
    const prev = this.ordered.slice().reverse().find(m => m.time < current);
    return prev?.time ?? null;
  }
  
  onChanged(callback: () => void): void {
    this.onChange = callback;
  }
  
  toJSON(): string {
    return JSON.stringify(this.ordered);
  }
}

export default WAAudioMarkers;
