import type { Channel, Transport } from './transport'

/**
 * In-memory network for tests: messages are queued and delivered in order by `settle()`,
 * and peers only hear each other once `connect()`ed.
 */
export class MemoryNetwork {
  private readonly nodes = new Map<string, MemoryNode>()
  private queue: (() => void)[] = []

  node(id: string): MemoryNode {
    const node = new MemoryNode(id, this)
    this.nodes.set(id, node)
    return node
  }

  enqueue(task: () => void) {
    this.queue.push(task)
  }

  connect(a: MemoryNode, b: MemoryNode) {
    a.peers.add(b.selfId)
    b.peers.add(a.selfId)
    this.enqueue(() => a.joinHandler?.(b.selfId))
    this.enqueue(() => b.joinHandler?.(a.selfId))
  }

  /** Removes a node from the network, as if its tab was closed. */
  disconnect(node: MemoryNode) {
    for (const peerId of node.peers) {
      const peer = this.nodes.get(peerId)!
      peer.peers.delete(node.selfId)
      this.enqueue(() => peer.leaveHandler?.(node.selfId))
    }
    node.peers.clear()
  }

  deliver(from: string, to: string, channel: string, data: unknown) {
    this.enqueue(() => {
      const node = this.nodes.get(to)
      // Dropped if the two were disconnected in the meantime.
      if (node?.peers.has(from)) node.handlers.get(channel)?.(structuredClone(data), from)
    })
  }

  /** Delivers queued messages (and the ones they trigger) until the network is quiet. */
  settle(maxSteps = 10_000) {
    for (let step = 0; this.queue.length; step++) {
      if (step > maxSteps) throw new Error('Network did not settle')
      this.queue.shift()!()
    }
  }
}

export class MemoryNode implements Transport {
  readonly peers = new Set<string>()
  readonly handlers = new Map<string, (data: unknown, peerId: string) => void>()
  joinHandler: ((peerId: string) => void) | null = null
  leaveHandler: ((peerId: string) => void) | null = null
  readonly selfId: string
  private readonly network: MemoryNetwork

  constructor(selfId: string, network: MemoryNetwork) {
    this.selfId = selfId
    this.network = network
  }

  channel<T>(name: string): Channel<T> {
    return {
      send: (data, target) => {
        for (const peerId of target ? [target] : this.peers) {
          if (this.peers.has(peerId)) this.network.deliver(this.selfId, peerId, name, data)
        }
      },
      onMessage: (handler) => {
        this.handlers.set(name, handler as (data: unknown, peerId: string) => void)
      },
    }
  }

  onPeerJoin(handler: (peerId: string) => void) {
    this.joinHandler = handler
  }

  onPeerLeave(handler: (peerId: string) => void) {
    this.leaveHandler = handler
  }

  leave() {
    this.network.disconnect(this)
  }
}
