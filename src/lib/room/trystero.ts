import { joinRoom, selfId, type JsonValue } from 'trystero'
import type { Transport } from './transport'

const APP_ID = 'letterboxd2tierlist-v1'

/** Peer-to-peer transport over WebRTC; peers find each other through public Nostr relays. */
export function trysteroTransport(roomId: string, onError: (message: string) => void): Transport {
  const room = joinRoom({ appId: APP_ID }, roomId, {
    onJoinError: ({ error }) => onError(error),
  })
  return {
    selfId,
    channel<T>(name: string) {
      const action = room.makeAction<JsonValue>(name)
      return {
        send: (data: T, target?: string) => void action.send(data as JsonValue, target ? { target } : undefined),
        onMessage: (handler: (data: T, peerId: string) => void) => {
          action.onMessage = (data, { peerId }) => handler(data as T, peerId)
        },
      }
    },
    onPeerJoin: (handler) => {
      room.onPeerJoin = handler
    },
    onPeerLeave: (handler) => {
      room.onPeerLeave = handler
    },
    leave: () => void room.leave(),
  }
}
