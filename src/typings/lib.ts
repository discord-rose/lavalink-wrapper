import { Track, TrackPartial } from '../structures/Track'

import { Snowflake } from 'discord-rose'

/**
 * Filters to apply to tracks.
 * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
 */
export interface Filters {
  channelMix?: {
    leftToLeft: number
    leftToRight: number
    rightToLeft: number
    rightToRight: number
  }
  distortion?: {
    sinOffset: number
    sinScale: number
    cosOffset: number
    cosScale: number
    tanOffset: number
    tanScale: number
    offset: number
    scale: number
  }
  equalizer?: Array<{ band: number, gain: number }>
  karaoke?: {
    level: number
    monoLevel: number
    filterBand: number
    filterWidth: number
  }
  lowPass?: {
    smoothing: number
  }
  rotation?: {
    rotationHz: number
  }
  timescale?: {
    speed?: number
    pitch?: number
    rate?: number
  }
  tremolo?: {
    frequency: number
    depth: number
  }
  vibrato?: {
    frequency: number
    depth: number
  }
}

export interface LavalinkManagerOptions {
  /**
   * An array of nodes to connect to.
   */
  nodeOptions: NodeOptions[]
  /**
   * An array of enabled sources.
   * If spotify is specified, the spotifyAuth option should also be defined.
   * @default ['youtube', 'soundcloud']
   */
  enabledSources?: Source[]
  /**
   * The default source to use for searches.
   * @default 'youtube'
   */
  defaultSource?: Source
  /**
   * Authentication for the spotify API.
   * This will enable resolving spotify links into youtube tracks.
   */
  spotifyAuth?: {
    clientId: string
    clientSecret: string
  }
}

export type LoopType = 'off' | 'single' | 'queue'

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

/**
 * Statistics about a node sent from the lavalink server.
 */
export interface NodeStats {
  /**
   * The number of players on the node.
   */
  players: number
  /**
   * The number of players playing on the node.
   */
  playingPlayers: number
  /**
   * The node's uptime.
   */
  uptime: number
  /**
   * Memory stats.
   */
  memory: {
    free: number
    used: number
    allocated: number
    reservable: number
  }
  /**
   * CPU stats.
   */
  cpu: {
    cores: number
    systemLoad: number
    lavalinkLoad: number
  }
  /**
   * Frame stats.
   */
  frameStats?: {
    sent: number
    nulled: number
    deficit: number
  }
}

export interface PlayerOptions {
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
  selfMute?: boolean
  /**
   * If the bot should self deafen.
   * @default true
   */
  selfDeafen?: boolean
  /**
   * The amount of time to allow to connect to a VC before timing out.
   * @default 15000
   */
  connectionTimeout?: number
  /**
   * If the bot should request to or become a speaker in stage channels depending on it's permissions.
   * @default true
   */
  becomeSpeaker?: boolean
  /**
   * Behavior to use when the bot is moved from the VC (This includes the bot being disconnected).
   * 'destroy' will destroy the player.
   * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is reconnected to the VC.
   * @default 'destroy'
   */
  moveBehavior?: 'destroy' | 'pause'
  /**
   * Behavior to use when the bot is moved to the audience in a stage channel. This has no effect if becomeSpeaker is false.
   * 'destroy' will destroy the player.
   * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is a speaker again. The bot will also request to speak, or become a speaker if it cannot request.
   * @default 'pause'
   */
  stageMoveBehavior?: 'destroy' | 'pause'
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

export type RequestMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  headers?: {
    [key: string]: string
  }
  query?: any
  body?: any
  parser?: (data: any) => string
}

/**
 * The result from a search.
 */
export interface SearchResult {
  /**
   * The result's load type.
   */
  loadType: 'TRACK_LOADED' | 'PLAYLIST_LOADED' | 'SEARCH_RESULT' | 'NO_MATCHES' | 'LOAD_FAILED'
  /**
   * The found tracks.
   */
  tracks: Array<Track | TrackPartial>
  /**
   * Playlist info, if applicable.
   */
  playlistInfo?: {
    name: string
    selectedTrack: Track | null
  }
  /**
   * An exception, if applicable.
   */
  exception?: {
    message: string
    severity: string
  }
}

/**
 * A search source.
 */
export type Source = 'youtube' | 'soundcloud'

export type ThumbnailResolution = 'default' | 'mqdefault' | 'hqdefault' | 'maxresdefault'

/**
 * Track data received from the server.
 * This is used internally when creating the Track class, and is not easily accessable by the user.
 */
export interface TrackData {
  /**
   * The base64 encoded track.
   */
  readonly track: string
  /**
   * Track information.
   */
  readonly info: {
    /**
     * The track's identifier.
     */
    readonly identifier: string
    /**
     * The track's author.
     */
    readonly author: string
    /**
     * The length of the track in milliseconds.
     */
    readonly length: number
    /**
     * If the track is a stream.
     */
    readonly isStream: boolean
    /**
     * The current position in the track, in milliseconds.
     */
    readonly position: number
    /**
     * The track's title.
     */
    readonly title: string
    /**
     * The track's URI.
     */
    readonly uri: string
    /**
     * The name of the track's source.
     */
    readonly sourceName: string
  }
}
