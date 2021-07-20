import { LavalinkManager } from '../typings/lib'

import { NodeStats } from '../typings/Lavalink'

import { EventEmitter } from '@jpbberry/typed-emitter'
import fetch, { Headers, Response } from 'node-fetch'
import { stringify } from 'querystring'
import WebSocket from 'ws'

export interface NodeEvents {
  /**
   * Emitted when the node connects to the lavalink server.
   */
  CONNECTED: Node
  /**
   * Emitted when the node is created.
   */
  CREATED: Node
  /**
   * Emitted when the node is destroyed.
   */
  DESTROYED: { node: Node, reason: string }
  /**
   * Emitted when the node disconnects from the lavalink server.
   */
  DISCONNECTED: { node: Node, code: number, reason: string }
  /**
   * Emitted when the node encounters an error.
   */
  ERROR: { node: Node, error: Error }
  /**
   * Emitted when the node receives a payload from the server.
   */
  RAW: { node: Node, payload: any }
  /**
   * Emitted when the node is attempting to reconnect.
   */
  RECONNECTING: Node
}

export interface NodeOptions {
  /**
   * The host for the node to use.
   * @default 'localhost'
   */
  host?: string
  /**
   * The port for the node to use.
   * @default 2333
   */
  port?: number
  /**
   * The password for the node to use.
   * @default 'youshallnotpass'
   */
  password?: string
  /**
   * If the connection is secure.
   * @default false
   */
  secure?: boolean
  /**
   * The client name to use.
   * @default 'rose-lavalink'
   */
  clientName?: string
  /**
   * The time to wait before timing out a request.
   * @default 15000
   */
  requestTimeout?: number
  /**
   * The maximum number of times to try to connect or reconnect. Setting this to 0 removes the limit.
   * @default 10
   */
  maxRetrys?: number
  /**
   * The time in milliseconds to wait between connection or reconnection attempts.
   * This must be greater than the connection timeout.
   * @default 30000
   */
  retryDelay?: number
  /**
   * The amount of time to allow to connect to the lavalink server before timing out.
   * This must be less than the connect / reconnect retry delay.
   * @default 15000
   */
  connectionTimeout?: number
}

export enum NodeState {
  DISCONNECTED,
  CONNECTING,
  RECONNECTING,
  CONNECTED,
  DESTROYED
}

export type RequestMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  headers?: {
    [key: string]: string
  }
  query?: any
  body?: any
  parser?: (data: any) => string
}

export class Node extends EventEmitter<NodeEvents> {
  /**
   * The node's options.
   */
  public readonly options: NodeOptions
  /**
   * The node's state.
   */
  public state: NodeState = NodeState.DISCONNECTED
  /**
   * The node's stats.
   */
  public stats: NodeStats = {
    players: 0,
    playingPlayers: 0,
    uptime: 0,
    memory: {
      free: 0,
      used: 0,
      allocated: 0,
      reservable: 0
    },
    cpu: {
      cores: 0,
      systemLoad: 0,
      lavalinkLoad: 0
    },
    frameStats: {
      sent: 0,
      nulled: 0,
      deficit: 0
    }
  }

  /**
   * Incremented when reconnecting to compare to Node#options#maxRetrys.
   */
  private reconnectAttempts: number = 0
  /**
   * Used for delaying reconnection attempts.
   */
  private reconnectTimeout: NodeJS.Timeout | null = null
  /**
   * The node's websocket.
   */
  private ws: WebSocket | null = null

  /**
   * Create a node.
   * @param options The options to use for the node.
   * @param identifier The node's identifier.
   * @param manager The node's manager.
   */
  constructor (options: NodeOptions, public identifier: number, public manager: LavalinkManager) {
    super()

    if (!options) throw new TypeError('Expected options to be defined')
    if (identifier === undefined) throw new TypeError('Expected identifier to be defined')
    if (!manager) throw new TypeError('Expected manager to be defined')

    this.options = {
      host: options.host ?? 'localhost',
      port: options.port ?? 2333,
      password: options.password ?? 'youshallnotpass',
      secure: options.secure ?? false,
      clientName: options.clientName ?? 'rose-lavalink',
      connectionTimeout: options.connectionTimeout ?? 15000,
      requestTimeout: options.requestTimeout ?? 15000,
      maxRetrys: options.maxRetrys ?? 10,
      retryDelay: options.retryDelay ?? 15000
    }

    if (this.options.connectionTimeout! > this.options.retryDelay!) throw new Error('Node connection timeout must be greater than the reconnect retry delay')

    this.on('CONNECTED', (data) => this.manager.emit('NODE_CONNECTED', data))
    this.on('CREATED', (data) => this.manager.emit('NODE_CREATED', data))
    this.on('DESTROYED', (data) => this.manager.emit('NODE_DESTROYED', data))
    this.on('DISCONNECTED', (data) => this.manager.emit('NODE_DISCONNECTED', data))
    this.on('ERROR', (data) => this.manager.emit('NODE_ERROR', data))
    this.on('RAW', (data) => this.manager.emit('NODE_RAW', data))
    this.on('RECONNECTING', (data) => this.manager.emit('NODE_RECONNECTING', data))

    this.emit('CREATED', this)
  }

  /**
   * Connect the node to the lavalink server.
   */
  public async connect (): Promise<void> {
    if (this.state !== NodeState.DISCONNECTED && this.state !== NodeState.RECONNECTING) throw new Error('Cannot initiate a connection when the node isn\'t in a disconnected or reconnecting state')

    const headers = {
      Authorization: this.options.password,
      'User-Id': this.manager.worker.user.id,
      'Client-Name': this.options.clientName
    }

    return await new Promise((resolve, reject) => {
      const timedOut = setTimeout(() => {
        const error = new Error('Timed out while connecting to the lavalink server')
        this.emit('ERROR', { node: this, error })
        reject(error)
      }, this.options.connectionTimeout)

      this.ws = new WebSocket(`ws${this.options.secure ? 's' : ''}://${this.options.host!}:${this.options.port!}/`, { headers })
      if (this.state !== NodeState.RECONNECTING) this.state = NodeState.CONNECTING
      this.ws.once('error', (error) => {
        this.ws!.removeAllListeners()
        this.ws = null
        if (this.state !== NodeState.RECONNECTING) this.state = NodeState.DISCONNECTED
        this._onError(error)
        if (timedOut) clearTimeout(timedOut)
        reject(error)
      })
      this.ws.once('open', () => {
        this.ws!.removeAllListeners()
        this._onOpen()
        this.ws!.on('open', this._onOpen.bind(this))
        this.ws!.on('close', this._onClose.bind(this))
        this.ws!.on('error', this._onError.bind(this))
        this.ws!.on('message', this._onMessage.bind(this))
        if (timedOut) clearTimeout(timedOut)
        resolve(undefined)
      })
    })
  }

  /**
   * Destroy the node and all attatched players.
   * @param reason The reason the node was destroyed.
   */
  public destroy (reason: string = 'Manual destroy'): void {
    this.ws?.close(1000, 'destroy')
    this.ws?.removeAllListeners()
    this.ws = null

    this.reconnectAttempts = 0
    if (this.reconnectTimeout) {
      clearInterval(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.manager.players.filter((player) => player.node.identifier === this.identifier).forEach((player) => player.destroy('Attached node destroyed'))

    this.state = NodeState.DESTROYED
    this.emit('DESTROYED', { node: this, reason })
    this.removeAllListeners()

    this.manager.nodes.delete(this.identifier)
  }

  /**
   * Send data to the lavalink server.
   * @param msg The data to send.
   */
  public async send (msg: any): Promise<boolean> {
    if (this.state !== NodeState.CONNECTED) throw new Error('Cannot send payloads before a connection is established')
    return await new Promise((resolve, reject) => {
      this.ws?.send(JSON.stringify(msg), (error) => {
        if (error) {
          this.emit('ERROR', { node: this, error })
          reject(error)
        } else resolve(true)
      })
    })
  }

  /**
   * Make a REST request.
   * @param method The method to use.
   * @param route The route to use.
   * @param options Request options.
   * @returns The response from the server.
   */
  public async request (method: RequestMethods, route: string, options: RequestOptions = {}): Promise<{ res: Response, json: any }> {
    const headers = new Headers()
    headers.set('Authorization', this.options.password!)
    if (options.body) headers.set('Content-Type', 'application/json')
    if (options.headers) Object.keys(options.headers).forEach((key) => headers.set(key, options.headers?.[key] as string))

    return await new Promise((resolve, reject) => {
      const timedOut = setTimeout(() => reject(new Error('408 Timed out on request')), this.options.requestTimeout)

      fetch(`http${this.options.secure ? 's' : ''}://${this.options.host!}:${this.options.port!}/${route.replace(/^\//gm, '')}${options.query ? `?${stringify(options.query)}` : ''}`, {
        method, headers, body: options.body ? (options.parser ?? JSON.stringify)(options.body) : undefined
      }).then(async (res) => {
        const json = res.status === 204 ? null : await res.json()
        if (timedOut) clearTimeout(timedOut)
        resolve({ res, json })
      }).catch((error) => {
        if (timedOut) clearTimeout(timedOut)
        reject(error)
      })
    })
  }

  /**
   * Attempt to reconnect the node to the server.
   */
  private reconnect (): void {
    this.state = NodeState.RECONNECTING
    this.reconnectTimeout = setInterval(() => {
      if (this.options.maxRetrys !== 0 && this.reconnectAttempts >= this.options.maxRetrys!) {
        this.emit('ERROR', { node: this, error: new Error(`Unable to reconnect after ${this.reconnectAttempts} attempts.`) })
        return this.destroy()
      }
      this.ws?.removeAllListeners()
      this.ws = null
      this.state = NodeState.RECONNECTING
      this.emit('RECONNECTING', this)
      this.connect().catch(() => this.reconnectAttempts++)
    }, this.options.retryDelay)
  }

  /**
   * Fired when the websocket emits an open event.
   */
  private _onOpen (): void {
    if (this.reconnectTimeout) {
      clearInterval(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.state = NodeState.CONNECTED
    this.emit('CONNECTED', this)
  }

  /**
   * Fired when the websocket emits a close event.
   * @param code The event's code.
   * @param reason The close reason.
   */
  private _onClose (code: number, reason: string): void {
    this.state = NodeState.DISCONNECTED
    this.emit('DISCONNECTED', { node: this, code, reason: reason.length ? reason : 'No reason specified' })
    if (code !== 1000 && reason !== 'destroy') this.reconnect()
  }

  /**
   * Fired when the websocket emits an error event.
   * @param error The error thrown.
   */
  private _onError (error: Error): void {
    if (!error) return
    this.emit('ERROR', { node: this, error })
  }

  /**
   * Fired when the websocket receives a message payload
   * @param data The received data.
   */
  private _onMessage (data: Buffer | string): void {
    if (Array.isArray(data)) data = Buffer.concat(data)
    else if (data instanceof ArrayBuffer) data = Buffer.from(data)
    const payload = JSON.parse(data.toString())
    this.emit('RAW', { node: this, payload })

    switch (payload.op) {
      case 'event':
      case 'playerUpdate':
        break
      case 'stats':
        delete payload.op
        this.stats = { ...payload }
        break
      default:
        this.emit('ERROR', { node: this, error: new Error(`Received unexpected op "${payload.op as string | number}"`) })
        break
    }
  }
}
