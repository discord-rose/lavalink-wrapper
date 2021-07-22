/**
 * Filters to apply to tracks.
 * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
 */
export interface Filters {
    channelMix?: {
        leftToLeft: number;
        leftToRight: number;
        rightToLeft: number;
        rightToRight: number;
    };
    distortion?: {
        sinOffset: number;
        sinScale: number;
        cosOffset: number;
        cosScale: number;
        tanOffset: number;
        tanScale: number;
        offset: number;
        scale: number;
    };
    equalizer?: Array<{
        band: number;
        gain: number;
    }>;
    karaoke?: {
        level: number;
        monoLevel: number;
        filterBand: number;
        filterWidth: number;
    };
    lowPass?: {
        smoothing: number;
    };
    rotation?: {
        rotationHz: number;
    };
    timescale?: {
        speed?: number;
        pitch?: number;
        rate?: number;
    };
    tremolo?: {
        frequency: number;
        depth: number;
    };
    vibrato?: {
        frequency: number;
        depth: number;
    };
}
/**
 * Statistics about a node sent from the lavalink server.
 */
export interface NodeStats {
    /**
     * The number of players on the node.
     */
    players: number;
    /**
     * The number of players playing on the node.
     */
    playingPlayers: number;
    /**
     * The node's uptime.
     */
    uptime: number;
    /**
     * Memory stats.
     */
    memory: {
        free: number;
        used: number;
        allocated: number;
        reservable: number;
    };
    /**
     * CPU stats.
     */
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    /**
     * Frame stats.
     */
    frameStats?: {
        sent: number;
        nulled: number;
        deficit: number;
    };
}
/**
 * Track data received from the server.
 * This is used internally when creating the Track class, and is not easily accessable by the user.
 */
export interface TrackData {
    /**
     * The base64 encoded track.
     */
    readonly track: string;
    /**
     * Track information.
     */
    readonly info: {
        /**
         * The track's identifier.
         */
        readonly identifier: string;
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
    };
}
