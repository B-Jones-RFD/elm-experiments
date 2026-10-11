/** In-process pub/sub. Subscribers re-read from the database; the message carries no payload. */
import { EventEmitter } from 'node:events'

const bus = new EventEmitter()
bus.setMaxListeners(0)

const key = (userId: string, event: string) => `${userId}:${event}`

export const publish = (userId: string, event: string): void => {
  bus.emit(key(userId, event))
}

/** Returns an unsubscribe function. */
export const subscribe = (userId: string, event: string, fn: () => void): (() => void) => {
  const k = key(userId, event)
  bus.on(k, fn)
  return () => {
    bus.off(k, fn)
  }
}
