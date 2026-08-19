import type { PetEvent } from './live2d.types'

class PetEventBus {
  publish(event: PetEvent): void {
    if (!window.electronAPI || JSON.stringify(event).length > 24_000) return
    window.electronAPI.publishPetEvent(event)
  }
}

export const petEventBus = new PetEventBus()
