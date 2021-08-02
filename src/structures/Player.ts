import { LavalinkManager, Node, Track, TrackPartial } from '../typings/lib'
import { Track as TrackClass, TrackPartial as TrackPartialClass } from './Track'

import { Filters } from '../typings/Lavalink'

import { APIRole, ChannelType } from 'discord-api-types'
import Collection from '@discordjs/collection'
import { EventEmitter } from '@jpbberry/typed-emitter'
import { PermissionsUtils, Snowflake } from 'discord-rose'

export interface CompletePlayerOptions {
  /**
   * The guild ID to bind the player to.
   */
  guildId: Snowflake
  /**
   * The text channel ID to bind the player to.
   */
  textChannelId: Snowflake
  /**
   * The voice channel ID to bind the player to.
   */
  voiceChannelId: Snowflake
  /**
   * If the bot should self mute.
   * @default false
   */
  selfMute: boolean
  /**
   * If the bot should self deafen.
   * @default true
   */
  selfDeafen: boolean
  /**
   * The amount of time to allow to connect to a VC before timing out.
   * @default 15000
   */
  connectionTimeout: number
  /**
   * If the bot should request to or become a speaker in stage channels depending on it's permissions.
   * @default true
   */
  becomeSpeaker: boolean
  /**
   * Behavior to use when the bot is moved from the VC (This includes the bot being disconnected).
   * 'destroy' will destroy the player.
   * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is reconnected to the VC.
   * @default 'destroy'
   */
  moveBehavior: 'destroy' | 'pause'
  /**
   * Behavior to use when the bot is moved to the audience in a stage channel. This has no effect if becomeSpeaker is false.
   * 'destroy' will destroy the player.
   * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is a speaker again. The bot will also request to speak, or become a speaker if it cannot request.
   * @default 'pause'
   */
  stageMoveBehavior: 'destroy' | 'pause'
}

export type LoopType = 'off' | 'single' | 'queue'

export interface PlayerEvents {
  /**
   * Emitted when the player connects to a VC.
   */
  CONNECTED: Player
  /**
   * Emitted when the player is created.
   */
  CREATED: Player
  /**
   * Emitted when the player is destroyed.
   */
  DESTROYED: { player: Player, reason: string }
  /**
   * Emitted when the player encounters an error.
   */
  ERROR: { player: Player, error: Error }
  /**
   * Emitted when the player manually moved. This includes the bot joining or leaving a VC.
   * The player is also automatically paused or destroyed when this event is emitted.
   */
  MOVED: { player: Player, oldChannel: Snowflake | null, newChannel: Snowflake | null }
  /**
   * Emitted when the player is paused.
   */
  PAUSED: { player: Player, reason: string }
  /**
   * Emitted when the player is resumed.
   */
  RESUMED: { player: Player, reason: string }
  /**
   * Emitted when the server sends a track end event.
   */
  TRACK_END: { player: Player, track: Track | null, reason: string }
  /**
   * Emitted when the server sends a track exception event.
   */
  TRACK_EXCEPTION: { player: Player, track: Track | null, message: string, severity: string, cause: string }
  /**
   * Emitted when the server sends a track start event.
   */
  TRACK_START: { player: Player, track: Track | null }
  /**
   * Emitted when the server sends a track stuck event.
   */
  TRACK_STUCK: { player: Player, track: Track | null, thresholdMs: number }
}

export interface PlayerOptions extends Partial<CompletePlayerOptions> {
  /**
   * The guild ID to bind the player to.
   */
  guildId: Snowflake
  /**
   * The text channel ID to bind the player to.
   */
  textChannelId: Snowflake
  /**
   * The voice channel ID to bind the player to.
   */
  voiceChannelId: Snowflake
}

export enum PlayerState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  PAUSED,
  PLAYING,
  DESTROYED
}

export interface PlayOptions {
  /**
   * The number of milliseconds to offset the track by.
   * @default 0
   */
  startTime?: number
  /**
   * The number of milliseconds at which point the track should stop playing. Defaults to the track's length.
   */
  endTime?: number
  /**
   * The volume to use. Minimum value of 0, maximum value of 1000.
   * @default 100
   */
  volume?: number
  /**
   * If true, playback will be paused when the track starts. This is ignored if the bot is in the audience in a stage.
   * @default false
   */
  pause?: boolean
}

export class Player extends EventEmitter<PlayerEvents> {
  /**
   * The player's current voice channel.
   */
  public currentVoiceChannel: Snowflake | null = null
  /**
   * The player's filters.
   * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
   */
  public filters: Filters = {}
  /**
   * If the player is a speaker. This is null if the player isn't connected, if the becomeSpeaker option is false, or if the channel is not a stage channel.
   * This is initially set when running Player#connect().
   */
  public isSpeaker: boolean | null = null
  /**
   * If the voice channel is a stage.
   * This is set when running Player#connect().
   */
  public isStage: boolean | null = null
  /**
   * The queue's loop behavior.
   */
  public loop: LoopType = 'off'
  /**
   * The player's options.
   */
  public readonly options: CompletePlayerOptions
  /**
   * The position in the track playing, in milliseconds.
   * This is null if no track is playing.
   */
  public position: number | null = null
  /**
   * The queue.
   */
  public queue: Array<Track | TrackPartial> = []
  /**
   * The current song playing, represented as an index of Player#queue. This is null if there isn't a song currently playing.
   */
  public queuePosition: number | null = null
  /**
   * The player's state.
   */
  public state: PlayerState = PlayerState.DISCONNECTED
  /**
   * The player's volume.
   */
  public volume: number = 100

  /**
   * The last recieved voice state data.
   */
  private lastVoiceState: any
  /**
   * A helper variable for setting the player's state after sending a play op with pause set to true.
   */
  private sentPausedPlay: boolean | null = null

  /**
   * Create a player.
   * @param options The options to use for the player.
   * @param node The player's node.
   * @param manager The player's manager.
   */
  constructor (options: PlayerOptions, public node: Node, public manager: LavalinkManager) {
    super()

    if (!options) throw new TypeError('Expected options to be defined')
    if (!manager) throw new TypeError('Expected manager to be defined')

    if (!options.guildId) throw new TypeError('Expected options.guildId to be defined')
    if (!options.textChannelId) throw new TypeError('Expected options.textChannelId to be defined')
    if (!options.voiceChannelId) throw new TypeError('Expected options.voiceChannelId to be defined')

    if (manager.players.has(options.guildId)) throw new Error('A player with the specified guild ID is already defined')

    this.options = {
      guildId: options.guildId,
      textChannelId: options.textChannelId,
      voiceChannelId: options.voiceChannelId,
      selfMute: options.selfMute ?? false,
      selfDeafen: options.selfDeafen ?? true,
      connectionTimeout: options.connectionTimeout ?? 15000,
      becomeSpeaker: options.becomeSpeaker ?? true,
      moveBehavior: options.moveBehavior ?? 'destroy',
      stageMoveBehavior: options.stageMoveBehavior ?? 'pause'
    }

    this.node.on('RAW', this._handlePayload.bind(this))

    this.on('CONNECTED', (data) => this.manager.emit('PLAYER_CONNECTED', data))
    this.on('CREATED', (data) => this.manager.emit('PLAYER_CREATED', data))
    this.on('DESTROYED', (data) => this.manager.emit('PLAYER_DESTROYED', data))
    this.on('ERROR', (data) => this.manager.emit('PLAYER_ERROR', data))
    this.on('MOVED', (data) => this.manager.emit('PLAYER_MOVED', data))
    this.on('TRACK_END', (data) => this.manager.emit('PLAYER_TRACK_END', data))
    this.on('TRACK_EXCEPTION', (data) => this.manager.emit('PLAYER_TRACK_EXCEPTION', data))
    this.on('TRACK_START', (data) => this.manager.emit('PLAYER_TRACK_START', data))
    this.on('TRACK_STUCK', (data) => this.manager.emit('PLAYER_TRACK_STUCK', data))

    this.emit('CREATED', this)
  }

  /**
   * If the player is paused.
   */
  public get paused (): boolean {
    return this.state === PlayerState.PAUSED
  }

  /**
   * If the player is playing a track.
   */
  public get playing (): boolean {
    return this.state === PlayerState.PLAYING
  }

  /**
   * The current track playing.
   */
  public get currentTrack (): Track | TrackPartial | null {
    return this.queuePosition !== null ? this.queue[this.queuePosition] : null
  }

  /**
   * Connect to a voice channel.
   * The player must be in a disconnected state.
   */
  public async connect (): Promise<void> {
    if (this.state !== PlayerState.DISCONNECTED) throw new Error('Cannot initiate a connection when the player isn\'t in a disconnected state')

    // @ts-expect-error Property 'ws' is private and only accessible within class 'Shard'.
    void this.manager.worker.guildShard(this.options.guildId).ws._send({
      op: 4,
      d: {
        guild_id: this.options.guildId,
        channel_id: this.options.voiceChannelId,
        self_mute: this.options.selfMute,
        self_deaf: this.options.selfDeafen
      }
    })

    this.state = PlayerState.CONNECTING

    return await new Promise((resolve, reject) => {
      const timedOut = setTimeout(() => {
        const error = new Error('Timed out while connecting to the voice channel')
        this.emit('ERROR', { player: this, error })
        reject(error)
      }, this.options.connectionTimeout)

      const onConnect: () => Promise<void> = async () => {
        this.removeListener('DESTROYED', onDestroy)
        if (this.options.becomeSpeaker) {
          const voiceChannel = await this.manager.worker.api.channels.get(this.options.voiceChannelId)
          if (voiceChannel.type === ChannelType.GuildStageVoice) {
            this.isStage = true
            this.isSpeaker = false
            const permissions = await this._getStagePermissions()
            if (permissions.becomeSpeaker) {
              await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                body: { channel_id: this.options.voiceChannelId, suppress: false }
              })
              this.isSpeaker = true
            } else if (permissions.request) {
              await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                body: { channel_id: this.options.voiceChannelId, request_to_speak_timestamp: new Date().toISOString() }
              })
            } else {
              if (this.currentVoiceChannel) void this._disconnect()
              const error = new Error('Failed to connect to the stage channel, the bot does not have permissions to request to or become a speaker')
              this.emit('ERROR', { player: this, error })
              if (timedOut) clearTimeout(timedOut)
              reject(error)
            }
          } else this.isStage = false
        }
        if (timedOut) clearTimeout(timedOut)
        resolve(undefined)
      }
      const onDestroy: (data: { player: Player, reason: string }) => void = (data) => {
        this.removeListener('CONNECTED', onConnect)
        if (this.currentVoiceChannel) void this._disconnect()
        const error = new Error(`Failed to connect to the voice channel, Player was destroyed: ${data.reason}`)
        this.emit('ERROR', { player: this, error })
        reject(error)
      }

      this.once('CONNECTED', onConnect)
      this.once('DESTROYED', onDestroy)
    })
  }

  /**
   * Destroy the player.
   * @param reason The reason the player was destroyed.
   */
  public destroy (reason: string = 'Manual destroy'): void {
    this.node.removeListener('RAW', this._handlePayload)
    if (this.currentVoiceChannel) void this._disconnect()
    void this.node.send({
      op: 'destroy',
      guildId: this.options.guildId
    })
    this.queue = []
    this.queuePosition = null
    this.position = null
    this.state = PlayerState.DESTROYED
    this.emit('DESTROYED', { player: this, reason })
    this.removeAllListeners()
    this.manager.players.delete(this.options.guildId)
  }

  /**
   * Queue and play a track or tracks.
   * If a track is already playing, the specified track(s) will only be pushed to the queue.
   * @param track The track or track partial to queue and play.
   * @param options Play options.
   * @returns The track played.
   */
  public async play (track: (Track | TrackPartial) | Array<Track | TrackPartial>, options?: PlayOptions): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot play when the player isn\'t in a connected, paused, or playing state')

    if (track instanceof Array) this.queue.push(...track)
    else this.queue.push(track)

    if (this.state === PlayerState.CONNECTED) {
      const newPosition = track instanceof Array ? this.queue.length - track.length : this.queue.length - 1
      if (this.queue[newPosition] instanceof TrackPartialClass) this.queue[newPosition] = await this.manager.resolveTrack(this.queue[newPosition])
      if (!(this.queue[newPosition] instanceof TrackClass) || !(this.queue[newPosition] as Track).track) throw new TypeError('Invalid track')
      await this._play(this.queue[newPosition] as Track, options)
      this.queuePosition = newPosition
    }
  }

  /**
   * Skip to the next track based on the player's loop behavior, or to a specified index of the queue.
   * @param index The index to skip to.
   */
  public async skip (index?: number): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot skip when the player isn\'t in a connected, paused, or playing state')
    await this._stop()
    if (typeof index === 'number') {
      if (index < 0 || index >= this.queue.length) throw new Error('Invalid index')
      if (this.queue[index] instanceof TrackPartialClass) this.queue[index] = await this.manager.resolveTrack(this.queue[index])
      if (!(this.queue[index] instanceof TrackClass) || !(this.queue[index] as Track).track) throw new TypeError('Invalid track')
      await this._play(this.queue[index] as Track)
      this.queuePosition = index
    } else await this._advanceQueue()
  }

  /**
   * Shuffles the queue and starts playing the first track.
   */
  public async shuffle (): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot shuffle when the player isn\'t in a connected, paused, or playing state')
    await this._stop()
    let currentIndex = this.queue.length
    let randomIndex = 0
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex--
      [this.queue[currentIndex], this.queue[randomIndex]] = [this.queue[randomIndex], this.queue[currentIndex]]
    }
    if (this.queue[0] instanceof TrackPartialClass) this.queue[0] = await this.manager.resolveTrack(this.queue[0])
    if (!(this.queue[0] instanceof TrackClass) || !(this.queue[0]).track) throw new Error('Invalid track at new queue position 0')
    await this._play(this.queue[0])
    this.queuePosition = 0
  }

  /**
   * Seek to a desired position.
   * @param position The position in the track to seek to, in milliseconds.
   */
  public async seek (position: number): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot seek when the player isn\'t in a connected, paused, or playing state')
    if (typeof position !== 'number') throw new TypeError('Expected position to be defined')
    if (position < 0) throw new Error('Position must be greater than 0')
    await this.node.send({
      op: 'seek',
      guildId: this.options.guildId,
      position
    })
  }

  /**
   * Pause a track.
   */
  public async pause (reason: string = 'Manual Pause'): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot pause when the player isn\'t in a connected, paused, or playing state')
    await this.node.send({
      op: 'pause',
      guildId: this.options.guildId,
      pause: true
    })
    this.state = PlayerState.PAUSED
    this.emit('PAUSED', { player: this, reason })
  }

  /**
   * Resume a track.
   */
  public async resume (reason: string = 'Manual Resume'): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot resume when the player isn\'t in a connected, paused, or playing state')
    await this.node.send({
      op: 'pause',
      guildId: this.options.guildId,
      pause: false
    })
    this.state = PlayerState.PLAYING
    this.emit('RESUMED', { player: this, reason })
  }

  /**
   * Stop the player.
   */
  public async stop (): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot stop when the player isn\'t in a connected, paused, or playing state')
    await this._stop()
    this.queuePosition = null
  }

  /**
   * Clear the queue.
   * @param stop If true, if a track is currently playing it will be stopped and removed from the queue. If false, if a track is playing it will be preserved.
   */
  public async clear (stop: boolean): Promise<void> {
    if (stop) await this.stop()
    this.queue = this.currentTrack ? [this.currentTrack] : []
  }

  /**
   * Set the queue's loop behavior.
   * @param type The loop type to use.
   */
  public setLoop (type: LoopType): void {
    this.loop = type
  }

  /**
   * Set the player's volume.
   * @param volume The volume to set the player to.
   */
  public async setVolume (volume: number): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot set volume when the player isn\'t in a connected, paused, or playing state')
    if (volume < 0 || volume > 1000) throw new Error('Volume must be between 0 and 1000')
    this.volume = volume
    await this.node.send({
      op: 'volume',
      guildId: this.options.guildId,
      volume
    })
  }

  /**
   * Set the player's filters.
   * @param filters The filters to use. An empty object clears filters.
   * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
   */
  public async setFilters (filters: Filters): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot set filters when the player isn\'t in a connected, paused, or playing state')
    if (!filters) throw new TypeError('Expected filters to be defined')
    await this.node.send(Object.assign({
      op: 'filters',
      guildId: this.options.guildId
    }, filters))
    this.filters = filters
  }

  /**
   * Advance the queue.
   */
  private async _advanceQueue (): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) return void this.emit('ERROR', { player: this, error: new Error('Cannot advance the queue when the player isn\'t in a connected, paused, or playing state') })
    if (this.queuePosition === null) this.queuePosition = 0
    else {
      if (this.loop !== 'single') this.queuePosition++
      if (!this.currentTrack && this.loop === 'queue') this.queuePosition = 0
    }

    if (this.currentTrack) {
      if (this.currentTrack instanceof TrackPartialClass) this.queue[this.queuePosition] = await this.manager.resolveTrack(this.currentTrack)
      if (!(this.currentTrack instanceof TrackClass) || !(this.currentTrack).track) {
        this.emit('ERROR', { player: this, error: new Error('Unable to get Track from new queue position while advancing the queue') })
        if (this.loop === 'single') this.queuePosition++
        await this._advanceQueue()
        return
      }
      this._play(this.currentTrack).catch(async (error) => {
        this.emit('ERROR', { player: this, error })
        if (this.loop === 'single') (this.queuePosition as number)++
        await this._advanceQueue()
      })
    } else this.queuePosition = null
  }

  /**
   * Disconnect the bot from VC.
   */
  private async _disconnect (): Promise<void> {
    // @ts-expect-error Property 'ws' is private and only accessible within class 'Shard'.
    await this.manager.worker.guildShard(this.options.guildId).ws._send({
      op: 4,
      d: {
        guild_id: this.options.guildId,
        channel_id: null,
        self_mute: false,
        self_deafen: false
      }
    })
    this.currentVoiceChannel = null
    this.state = PlayerState.DISCONNECTED
  }

  /**
   * Get the bot's stage permissions.
   */
  private async _getStagePermissions (): Promise<{ becomeSpeaker: boolean, request: boolean }> {
    const voiceChannel = await this.manager.worker.api.channels.get(this.options.voiceChannelId)
    const guild = await this.manager.worker.api.guilds.get(this.options.guildId)
    const botPerms = PermissionsUtils.combine({
      guild,
      member: await this.manager.worker.api.members.get(guild.id, this.manager.worker.user.id),
      overwrites: voiceChannel.permission_overwrites,
      roleList: guild.roles.reduce<Collection<Snowflake, APIRole>>((p, c) => p.set(c.id, c), new Collection()) as any
    })
    return {
      becomeSpeaker: PermissionsUtils.has(botPerms, 'mute'),
      request: PermissionsUtils.has(botPerms, 'requestToSpeak' as any)
    }
  }

  /**
   * Handle the bot being moved.
   * @param newChannel The new voice channel ID.
   */
  private async _handleMove (newChannel: Snowflake | null, data: any): Promise<void> {
    if (newChannel !== this.currentVoiceChannel) this.emit('MOVED', { player: this, oldChannel: this.currentVoiceChannel, newChannel })

    const wasCorrect: boolean = this.options.voiceChannelId === this.currentVoiceChannel
    const nowCorrect: boolean = this.options.voiceChannelId === newChannel
    const wasSuppressed: boolean = this.lastVoiceState?.suppress ?? false
    const nowSuppressed: boolean = data.suppress

    if (this.state === PlayerState.CONNECTED || this.state === PlayerState.PAUSED || this.state === PlayerState.PLAYING) {
      if (this.options.moveBehavior === 'destroy' && (!nowCorrect || newChannel === null)) return this.destroy('Player was moved out of the voice channel')
      else if (this.options.moveBehavior === 'pause') {
        if (this.state === PlayerState.PAUSED && !wasCorrect && nowCorrect) void this.resume('Moved into the voice channel')
        else if (this.state === PlayerState.PLAYING && wasCorrect && !nowCorrect) void this.pause('Moved out of the voice channel')
      }

      if (this.isStage && this.options.becomeSpeaker && this.lastVoiceState) {
        this.isSpeaker = !nowSuppressed
        if (this.options.stageMoveBehavior === 'destroy' && !wasSuppressed && nowSuppressed) return this.destroy('Player was moved to the audience')
        else if (this.options.stageMoveBehavior === 'pause') {
          if (this.state === PlayerState.PAUSED && wasSuppressed && !nowSuppressed) void this.resume('Became a speaker')
          else if (this.state === PlayerState.PLAYING && !wasSuppressed && nowSuppressed) {
            void this.pause('Moved to the audience')
            const permissions = await this._getStagePermissions()
            if (permissions.request) {
              await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                body: { channel_id: this.options.voiceChannelId, request_to_speak_timestamp: new Date().toISOString() }
              })
            } else if (permissions.becomeSpeaker) {
              await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                body: { channel_id: this.options.voiceChannelId, suppress: false }
              })
            }
          }
        }
      }
    } else if (this.state === PlayerState.CONNECTING) {
      if (nowCorrect) {
        this.state = PlayerState.CONNECTED
        this.emit('CONNECTED', this)
      } else this.destroy('Connected to incorrect channel')
    }

    this.currentVoiceChannel = newChannel
    this.lastVoiceState = data
  }

  /**
   * Handle incoming payloads from the attached node.
   * @param payload The received payload.
   */
  private async _handlePayload ({ node, payload }: { node: Node, payload: any }): Promise<void> {
    if (payload.guildId !== this.options.guildId) return
    if (payload.op === 'playerUpdate') {
      this.position = payload.state.position ?? null
    } else if (payload.op === 'event') {
      const track = typeof payload.track === 'string' ? (await this.manager.decodeTracks([payload.track]))[0] : null
      // @ts-expect-error Cannot assign to 'requester' because it is a read-only property.
      if (track) track.requester = this.currentTrack?.title === track.title ? this.currentTrack.requester : this.queue.find((v) => v.title === track.title)
      switch (payload.type) {
        case 'TrackEndEvent':
          this.position = null
          this.state = PlayerState.CONNECTED
          this.emit('TRACK_END', { player: this, track, reason: payload.reason })
          if (payload.reason !== 'STOPPED' && payload.reason !== 'REPLACED') void this._advanceQueue()
          break
        case 'TrackExceptionEvent':
          this.emit('TRACK_EXCEPTION', { player: this, track, message: payload.exception.message, severity: payload.exception.severity, cause: payload.exception.cause })
          break
        case 'TrackStartEvent':
          if (this.sentPausedPlay) {
            this.state = PlayerState.PAUSED
            this.sentPausedPlay = null
          } else this.state = PlayerState.PLAYING
          this.emit('TRACK_START', { player: this, track })
          break
        case 'TrackStuckEvent':
          this.emit('TRACK_STUCK', { player: this, track, thresholdMs: payload.thresholdMs })
          await this._stop().catch(() => {})
          void this._advanceQueue()
          break
      }
    }
  }

  /**
   * Helper function for sending play payloads to the server.
   * @param track The track to play.
   * @param options Options to use in the play payload.
   */
  private async _play (track: Track, options?: PlayOptions): Promise<void> {
    if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING) throw new Error('Cannot play when the player isn\'t in a connected, paused, or playing state')

    if (typeof options?.volume === 'number') {
      if (options.volume < 0 || options.volume > 1000) throw new Error('Volume must be between 0 and 1000')
      this.volume = options.volume
      if (options.volume === 100) delete options.volume
    } else if (this.volume !== 100) options = Object.assign(options ?? {}, { volume: this.volume })

    if (this.isStage && !this.isSpeaker) options = Object.assign(options ?? {}, { pause: true })

    if (options?.pause) this.sentPausedPlay = true
    await this.node.send(Object.assign({
      op: 'play',
      guildId: this.options.guildId,
      track: track.track
    }, options))
  }

  /**
   * Helper function for sending stop payloads to the server.
   */
  private async _stop (): Promise<void> {
    await this.node.send({
      op: 'stop',
      guildId: this.options.guildId
    })
    this.position = null
    this.state = PlayerState.CONNECTED
  }
}
