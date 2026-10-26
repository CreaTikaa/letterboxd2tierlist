/** Minimal messaging layer the room protocol needs; Trystero in the app, an in-memory fake in tests. */
export interface Channel<T> {
  /** Sends to one peer, or to everyone when `target` is omitted. */
  send: (data: T, target?: string) => void
  onMessage: (handler: (data: T, peerId: string) => void) => void
}

export interface Transport {
  selfId: string
  channel: <T>(name: string) => Channel<T>
  onPeerJoin: (handler: (peerId: string) => void) => void
  onPeerLeave: (handler: (peerId: string) => void) => void
  leave: () => void
}
