import { Node, Player, Track, TrackPartial } from '../typings/lib';
import { NodeOptions } from './Node';
import { PlayerOptions } from './Player';
import Collection from '@discordjs/collection';
import { EventEmitter } from '@jpbberry/typed-emitter';
import { Snowflake, Worker } from 'discord-rose';
export interface LavalinkManagerEvents {
    /**
     * Emitted when a node connects to it's lavalink server.
     */
    NODE_CONNECTED: Node;
    /**
     * Emitted when a node is created.
     */
    NODE_CREATED: Node;
    /**
     * Emitted when a node is destroyed.
     */
    NODE_DESTROYED: {
        node: Node;
        reason: string;
    };
    /**
     * Emitted when a node disconnects from it's lavalink server.
     */
    NODE_DISCONNECTED: {
        node: Node;
        code: number;
        reason: string;
    };
    /**
     * Emitted when a node encounters an error.
     */
    NODE_ERROR: {
        node: Node;
        error: Error;
    };
    /**
     * Emitted when a node receives a payload from it's server.
     */
    NODE_RAW: {
        node: Node;
        payload: any;
    };
    /**
     * Emitted when a node is attempting to reconnect.
     */
    NODE_RECONNECTING: Node;
    /**
     * Emitted when a player connects to a VC.
     */
    PLAYER_CONNECTED: Player;
    /**
     * Emitted when a player is created.
     */
    PLAYER_CREATED: Player;
    /**
     * Emitted when a player is destroyed.
     */
    PLAYER_DESTROYED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when a player encounters an error.
     */
    PLAYER_ERROR: {
        player: Player;
        error: Error;
    };
    /**
     * Emitted when a player manually moved. This includes the bot joining or leaving a VC.
     * The player is also automatically paused or destroyed when this event is emitted.
     */
    PLAYER_MOVED: {
        player: Player;
        oldChannel: Snowflake | null;
        newChannel: Snowflake | null;
    };
    /**
     * Emitted when a player is paused.
     */
    PLAYER_PAUSED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when a player is resumed.
     */
    PLAYER_RESUMED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when the server sends a track end event.
     */
    PLAYER_TRACK_END: {
        player: Player;
        track: Track;
        reason: string;
    };
    /**
     * Emitted when the server sends a track exception event.
     */
    PLAYER_TRACK_EXCEPTION: {
        player: Player;
        track: Track | TrackPartial | null;
        message: string;
        severity: string;
        cause: string;
    };
    /**
     * Emitted when the server sends a track start event.
     */
    PLAYER_TRACK_START: {
        player: Player;
        track: Track;
    };
    /**
     * Emitted when the server sends a track stuck event.
     */
    PLAYER_TRACK_STUCK: {
        player: Player;
        track: Track;
        thresholdMs: number;
    };
}
export interface LavalinkManagerOptions {
    /**
     * An array of nodes to connect to.
     */
    nodeOptions: NodeOptions[];
    /**
     * An array of enabled sources.
     * If spotify is specified, the spotifyAuth option should also be defined.
     * @default ['youtube', 'soundcloud']
     */
    enabledSources?: Source[];
    /**
     * The default source to use for searches.
     * @default 'youtube'
     */
    defaultSource?: Source;
    /**
     * Authentication for the spotify API.
     * This will enable resolving spotify links into youtube tracks.
     */
    spotifyAuth?: {
        clientId: string;
        clientSecret: string;
    };
}
/**
 * The result from a search.
 */
export interface SearchResult {
    /**
     * The result's load type.
     */
    loadType: 'TRACK_LOADED' | 'PLAYLIST_LOADED' | 'SEARCH_RESULT' | 'NO_MATCHES' | 'LOAD_FAILED';
    /**
     * The found tracks.
     */
    tracks: Array<Track | TrackPartial>;
    /**
     * Playlist info, if applicable.
     */
    playlistInfo?: {
        name: string;
        selectedTrack: Track | null;
    };
    /**
     * An exception, if applicable.
     */
    exception?: {
        message: string;
        severity: string;
    };
}
/**
 * A search source.
 */
export declare type Source = 'youtube' | 'soundcloud';
export declare class LavalinkManager extends EventEmitter<LavalinkManagerEvents> {
    worker: Worker;
    /**
     * The manager's nodes.
     */
    nodes: Collection<number, Node>;
    /**
     * The manager's options.
     */
    readonly options: LavalinkManagerOptions;
    /**
     * The manager's players.
     */
    players: Collection<Snowflake, Player>;
    /**
     * The manager's spotify token.
     * Set when running LavalinkManager#connectNodes().
     */
    private spotifyToken;
    /**
     * Create a lavalink manager.
     * @param options The options to use for the manager.
     * @param worker The manager's worker.
     */
    constructor(options: LavalinkManagerOptions, worker: Worker);
    /**
     * Nodes sorted by cpu load.
     */
    get leastLoadNodes(): Node[];
    /**
     * Connect all nodes to their server.
     * @returns The results of node connection attempts.
     */
    connectNodes(): Promise<Array<PromiseSettledResult<Node>>>;
    /**
     * Create a new player.
     * @param options The player's options.
     * @returns The created player.
     */
    createPlayer(options: PlayerOptions): Player;
    /**
     * Get search results based on a query.
     * If the query is a link, it will attempt to get a track from the link. If not, it will return results from a search using the specified or default source.
     * If spotify auth is defined in the manager config, spotify links will resolve into youtube tracks.
     * @param query The query to search with.
     * @param requester The user that requsted the track. This value is not crucial.
     * @param source The source to use if the query is not a link, or if the link is from spotify. Defaults to the manager's default source.
     * @returns The search result.
     */
    search(query: string, requester: string, source?: Source): Promise<SearchResult>;
    /**
     * Decode track strings into an array of tracks.
     * @param tracks The tracks encoded in base64.
     * @returns An array of the decoded tracks.
     */
    decodeTracks(tracks: string[]): Promise<Track[]>;
    resolveTrack(track: TrackPartial): Promise<Track>;
    /**
     * Handle voice state update data.
     * @param event The emitted event.
     * @param data Data from the event.
     */
    private _handleVoiceUpdate;
    /**
     * Renew the spotify token.
     */
    private _renewSpotifyToken;
    /**
     * A helper function for renewing the token when it expires.
     * @param time The time until the token expires.
     */
    private _renewExpiredSpotifyToken;
}
