export class PresentationCooldown {
  private lastKey = ''

  shouldRestart(key: string): boolean {
    if (this.lastKey === key) return false
    this.lastKey = key
    return true
  }

  reset(): void {
    this.lastKey = ''
  }
}
