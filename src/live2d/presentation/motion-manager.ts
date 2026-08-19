import type { MotionQueueItem, PresentationLayerState, PresentationSnapshot, PresentationSource } from '../live2d.types'

export interface MotionRunner {
  play(item: MotionQueueItem): Promise<boolean>
  stop(): void
  onFinished(callback: () => void): () => void
}

function sameMotion(left: MotionQueueItem | undefined, right: MotionQueueItem | undefined): boolean {
  return Boolean(left && right && left.name === right.name && left.source === right.source && left.loop === right.loop && left.priority === right.priority)
}

export class MotionManager {
  private readonly layers = new Map<PresentationSource, MotionQueueItem>()
  private readonly queue: MotionQueueItem[] = []
  private current: MotionQueueItem | undefined
  private lastPlayed: boolean | undefined
  private removeFinishedListener: (() => void) | undefined

  constructor(private readonly runner: MotionRunner, private readonly onChanged: () => void) {
    this.removeFinishedListener = runner.onFinished(() => this.handleFinished())
  }

  destroy(): void {
    this.removeFinishedListener?.()
    this.removeFinishedListener = undefined
    this.runner.stop()
    this.layers.clear()
    this.queue.length = 0
    this.current = undefined
    this.lastPlayed = undefined
  }

  setLayer(item: MotionQueueItem): boolean {
    const existing = this.layers.get(item.source)
    if (existing && sameMotion(existing, item)) {
      this.layers.set(item.source, { ...existing, intensity: item.intensity })
      this.onChanged()
      return false
    }
    const active = this.current
    if (active && active.source !== item.source && item.priority >= active.priority) {
      if (item.interruptPolicy === 'ignore') return false
      if (item.interruptPolicy === 'queue') {
        this.queue.push({ ...item })
        this.onChanged()
        return true
      }
      if (item.interruptPolicy === 'cancel') this.queue.length = 0
    }
    this.layers.set(item.source, { ...item })
    void this.rebuild()
    return true
  }

  enqueue(items: MotionQueueItem[]): void {
    this.queue.push(...items.map((item) => ({ ...item })))
    void this.rebuild()
  }

  clear(source: PresentationSource): void {
    const hadLayer = this.layers.delete(source)
    const hadQueue = this.queue.some((item) => item.source === source)
    for (let index = this.queue.length - 1; index >= 0; index -= 1) if (this.queue[index].source === source) this.queue.splice(index, 1)
    if (this.current?.source === source) {
      this.runner.stop()
      this.current = undefined
      this.lastPlayed = undefined
      void this.rebuild()
    }
    if (hadLayer || hadQueue) this.onChanged()
  }

  clearAll(): void {
    this.runner.stop()
    this.layers.clear()
    this.queue.length = 0
    this.current = undefined
    this.lastPlayed = undefined
    this.onChanged()
  }

  refresh(): void {
    this.current = undefined
    this.lastPlayed = undefined
    void this.rebuild()
  }

  handleFinished(): void {
    const finished = this.current
    if (!finished) return
    if (finished.loop && this.layers.get(finished.source)?.name === finished.name) {
      void this.runner.play(finished)
      return
    }
    this.current = undefined
    this.layers.delete(finished.source)
    const nextQueued = this.queue.shift()
    if (nextQueued) this.layers.set(nextQueued.source, nextQueued)
    void this.rebuild()
  }

  getLayers(): PresentationLayerState[] {
    return [...this.layers.values()]
      .sort((left, right) => left.priority - right.priority)
      .map((item) => ({ ...item, curve: 'linear' as const }))
  }

  getQueue(): MotionQueueItem[] {
    return this.queue.map((item) => ({ ...item }))
  }

  getActiveLayer(): PresentationLayerState | undefined {
    return this.getLayers().at(-1)
  }

  getPlaybackStatus(): { name?: string, played?: boolean } {
    return { name: this.current?.name, played: this.lastPlayed }
  }

  snapshot(): PresentationLayerState[] {
    return this.getLayers().map((layer) => ({ ...layer }))
  }

  restore(snapshot: PresentationSnapshot): void {
    this.runner.stop()
    this.layers.clear()
    this.queue.splice(0, this.queue.length, ...(snapshot.motionQueue ?? []).map((item) => ({ ...item })))
    for (const layer of snapshot.motionLayers) this.layers.set(layer.source, { ...layer, interruptPolicy: 'cancel' })
    this.current = undefined
    this.lastPlayed = undefined
    void this.rebuild()
  }

  private async rebuild(): Promise<void> {
    let candidate = this.getLayers().at(-1) as MotionQueueItem | undefined
    if (!candidate && this.queue.length) {
      candidate = this.queue.shift()
      if (candidate) this.layers.set(candidate.source, candidate)
    }
    if (!candidate) {
      this.runner.stop()
      this.current = undefined
      this.lastPlayed = undefined
      this.onChanged()
      return
    }
    if (sameMotion(this.current, candidate)) {
      this.onChanged()
      return
    }
    this.runner.stop()
    this.current = { ...candidate }
    this.lastPlayed = await this.runner.play(this.current)
    this.onChanged()
  }
}
