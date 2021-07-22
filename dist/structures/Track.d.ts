import { TrackData } from '../typings/Lavalink';
export declare type ThumbnailResolution = 'default' | 'mqdefault' | 'hqdefault' | 'maxresdefault';
/**
 * Track partial - represents an unresolved track.
 */
export declare class TrackPartial {
    readonly title: string;
    readonly requester: string;
    readonly author?: string | undefined;
    readonly length?: number | undefined;
    /**
     * Create a track partial.
     * @param title The track's title.
     * @param requester The track's requester.
     * @param author The track's author.
     * @param length The track's length in milliseconds.
     */
    constructor(title: string, requester: string, author?: string | undefined, length?: number | undefined);
}
export declare class Track {
    readonly requester: string;
    /**
     * The track encoded into base64.
     */
    readonly track: string;
    /**
     * The track's identifier.
     */
    readonly identifier: string;
    /**
     * If the track is seekable.
     */
    readonly isSeekable: boolean;
    /**
     * The track's author.
     */
    readonly author: string;
    /**
     * The length of the track in milliseconds.
     */
    readonly length: number;
    /**
     * If the track is a stream.
     */
    readonly isStream: boolean;
    /**
     * The current position in the track, in milliseconds.
     */
    readonly position: number;
    /**
     * The track's title.
     */
    readonly title: string;
    /**
     * The track's URI.
     */
    readonly uri: string;
    /**
     * The name of the track's source.
     */
    readonly sourceName: string;
    /**
     * Create a new track.
     * @param data Track data from the server.
     * @param requester The track's requester.
     */
    constructor(data: TrackData, requester: string);
    /**
     * Get the track's thumbnail. This is only supported by tracks with sourceName = 'youtube'.
     * @param resolution The thumbnail resolution.
     * @returns The track's thumbnail, if available.
     */
    thumbnail(resolution: ThumbnailResolution): string | undefined;
}
