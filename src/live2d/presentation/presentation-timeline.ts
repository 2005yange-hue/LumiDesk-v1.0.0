import type { PresentationLayerState, PresentationTimelineEntry, PresentationSource, PresentationState } from '../live2d.types'

export class PresentationTimeline {
  private readonly entries: PresentationTimelineEntry[] = []

  push(entry: Omit<PresentationTimelineEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: Date.now(), layers: entry.layers.map((layer) => ({ ...layer })) })
    while (this.entries.length > 100) this.entries.shift()
  }

  list(): PresentationTimelineEntry[] {
    return this.entries.slice().reverse().map((entry) => ({ ...entry, layers: entry.layers.map((layer) => ({ ...layer })) }))
  }

  clear(): void {
    this.entries.length = 0
  }

  static event(source: PresentationSource, state: PresentationState, action: PresentationTimelineEntry['action'], layers: PresentationLayerState[], details: Partial<PresentationTimelineEntry> = {}): Omit<PresentationTimelineEntry, 'timestamp'> {
    return { event: details.event ?? 'presentation', source, state, action, layers, ...details }
  }
}
