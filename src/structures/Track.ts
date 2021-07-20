import { TrackData } from '../typings/Lavalink'

export type ThumbnailResolution = 'default' | 'mqdefault' | 'hqdefault' | 'maxresdefault'

/**
 * Track partial - represents an unresolved track.
 */
export class TrackPartial {
  /**
   * Create a track partial.
   * @param title The track's title.
   * @param requester The track's requester.
   * @param author The track's author.
   * @param length The track's length in milliseconds.
   */
  constructor (public readonly title: string, public readonly requester: string, public readonly author?: string, public readonly length?: number) {}
}

export class Track {
  /**
   * The track encoded into base64.
   */
  public readonly track: string
  /**
   * The track's identifier.
   */
  public readonly identifier: string
  /**
   * If the track is seekable.
   */
  public readonly isSeekable: boolean
  /**
   * The track's author.
   */
  public readonly author: string
  /**
   * The length of the track in milliseconds.
   */
  public readonly length: number
  /**
   * If the track is a stream.
   */
  public readonly isStream: boolean
  /**
   * The current position in the track, in milliseconds.
   */
  public readonly position: number
  /**
   * The track's title.
   */
  public readonly title: string
  /**
   * The track's URI.
   */
  public readonly uri: string
  /**
   * The name of the track's source.
   */
  public readonly sourceName: string

  /**
   * Create a new track.
   * @param data Track data from the server.
   * @param requester The track's requester.
   */
  constructor (data: TrackData, public readonly requester: string) {
    if (!data) throw new TypeError('Expected data to be defined')

    this.track = data.track
    for (const info in data.info) this[info] = data.info[info]
  }

  /**
   * Get the track's thumbnail. This is only supported by tracks with sourceName = 'youtube'.
   * @param resolution The thumbnail resolution.
   * @returns The track's thumbnail, if available.
   */
  public thumbnail (resolution: ThumbnailResolution): string | undefined {
    if (this.sourceName === 'youtube') return `https://img.youtube.com/vi/${this.identifier}/${resolution}.jpg`
  }
}
