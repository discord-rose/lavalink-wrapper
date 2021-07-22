import { LavalinkManager, Node, Track, TrackPartial } from '../typings/lib';
import { Filters } from '../typings/Lavalink';
import { EventEmitter } from '@jpbberry/typed-emitter';
import { Snowflake } from 'discord-rose';
export declare type LoopType = 'off' | 'single' | 'queue';
export interface PlayerEvents {
    /**
     * Emitted when the player connects to a VC.
     */
    CONNECTED: Player;
    /**
     * Emitted when the player is created.
     */
    CREATED: Player;
    /**
     * Emitted when the player is destroyed.
     */
    DESTROYED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when the player encounters an error.
     */
    ERROR: {
        player: Player;
        error: Error;
    };
    /**
     * Emitted when the player manually moved. This includes the bot joining or leaving a VC.
     * The player is also automatically paused or destroyed when this event is emitted.
     */
    MOVED: {
        player: Player;
        oldChannel: Snowflake | null;
        newChannel: Snowflake | null;
    };
    /**
     * Emitted when the player is paused.
     */
    PAUSED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when the player is resumed.
     */
    RESUMED: {
        player: Player;
        reason: string;
    };
    /**
     * Emitted when the server sends a track end event.
     */
    TRACK_END: {
        player: Player;
        track: Track;
        reason: string;
    };
    /**
     * Emitted when the server sends a track exception event.
     */
    TRACK_EXCEPTION: {
        player: Player;
        track: Track | TrackPartial | null;
        message: string;
        severity: string;
        cause: string;
    };
    /**
     * Emitted when the server sends a track start event.
     */
    TRACK_START: {
        player: Player;
        track: Track;
    };
    /**
     * Emitted when the server sends a track stuck event.
     */
    TRACK_STUCK: {
        player: Player;
        track: Track;
        thresholdMs: number;
    };
}
export interface PlayerOptions {
    /**
     * The guild ID to bind the player to.
     */
    guildId: Snowflake;
    /**
     * The text channel ID to bind the player to.
     */
    textChannelId: Snowflake;
    /**
     * The voice channel ID to bind the player to.
     */
    voiceChannelId: Snowflake;
    /**
     * If the bot should self mute.
     * @default false
     */
    selfMute?: boolean;
    /**
     * If the bot should self deafen.
     * @default true
     */
    selfDeafen?: boolean;
    /**
     * The amount of time to allow to connect to a VC before timing out.
     * @default 15000
     */
    connectionTimeout?: number;
    /**
     * If the bot should request to or become a speaker in stage channels depending on it's permissions.
     * @default true
     */
    becomeSpeaker?: boolean;
    /**
     * Behavior to use when the bot is moved from the VC (This includes the bot being disconnected).
     * 'destroy' will destroy the player.
     * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is reconnected to the VC.
     * @default 'destroy'
     */
    moveBehavior?: 'destroy' | 'pause';
    /**
     * Behavior to use when the bot is moved to the audience in a stage channel. This has no effect if becomeSpeaker is false.
     * 'destroy' will destroy the player.
     * 'pause' will send a pause payload to the lavalink server, and will resume when the bot is a speaker again. The bot will also request to speak, or become a speaker if it cannot request.
     * @default 'pause'
     */
    stageMoveBehavior?: 'destroy' | 'pause';
}
export declare enum PlayerState {
    DISCONNECTED = 0,
    CONNECTING = 1,
    CONNECTED = 2,
    PAUSED = 3,
    PLAYING = 4,
    DESTROYED = 5
}
export interface PlayOptions {
    /**
     * The number of milliseconds to offset the track by.
     * @default 0
     */
    startTime?: number;
    /**
     * The number of milliseconds at which point the track should stop playing. Defaults to the track's length.
     */
    endTime?: number;
    /**
     * The volume to use. Minimum value of 0, maximum value of 1000.
     * @default 100
     */
    volume?: number;
    /**
     * If true, playback will be paused when the track starts. This is ignored if the bot is in the audience in a stage.
     * @default false
     */
    pause?: boolean;
}
export declare class Player extends EventEmitter<PlayerEvents> {
    node: Node;
    manager: LavalinkManager;
    /**
     * The player's current voice channel.
     */
    currentVoiceChannel: Snowflake | null;
    /**
     * The player's filters.
     * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
     */
    filters: Filters;
    /**
     * If the player is a speaker. This is null if the player isn't connected, if the becomeSpeaker option is false, or if the channel is not a stage channel.
     * This is initially set when running Player#connect().
     */
    isSpeaker: boolean | null;
    /**
     * If the voice channel is a stage.
     * This is set when running Player#connect().
     */
    isStage: boolean | null;
    /**
     * The queue's loop behavior.
     */
    loop: LoopType;
    /**
     * The player's options.
     */
    readonly options: PlayerOptions;
    /**
     * The position in the track playing, in milliseconds.
     * This is null if no track is playing.
     */
    position: number | null;
    /**
     * The queue.
     */
    queue: Array<Track | TrackPartial>;
    /**
     * The current song playing, represented as an index of Player#queue. This is null if there isn't a song currently playing.
     */
    queuePosition: number | null;
    /**
     * The player's state.
     */
    state: PlayerState;
    /**
     * The player's volume.
     */
    volume: number;
    /**
     * The last recieved voice state data.
     */
    private lastVoiceState;
    /**
     * A helper variable for setting the player's state after sending a play op with pause set to true.
     */
    private sentPausedPlay;
    /**
     * Create a player.
     * @param options The options to use for the player.
     * @param node The player's node.
     * @param manager The player's manager.
     */
    constructor(options: PlayerOptions, node: Node, manager: LavalinkManager);
    /**
     * Connect to a voice channel.
     * The player must be in a disconnected state.
     */
    connect(): Promise<void>;
    /**
     * Destroy the player.
     * @param reason The reason the player was destroyed.
     */
    destroy(reason?: string): void;
    /**
     * Queue and play a track or tracks.
     * If a track is already playing, the specified track(s) will only be pushed to the queue.
     * @param track The track or track partial to queue and play.
     * @param options Play options.
     * @returns The track played.
     */
    play(track: (Track | TrackPartial) | Array<Track | TrackPartial>, options?: PlayOptions): Promise<void>;
    /**
     * Skip to the next track based on the player's loop behavior, or to a specified index of the queue.
     * @param index The index to skip to.
     */
    skip(index?: number): Promise<void>;
    /**
     * Shuffles the queue and starts playing the first track.
     */
    shuffle(): Promise<void>;
    /**
     * Seek to a desired position.
     * @param position The position in the track to seek to, in milliseconds.
     */
    seek(position: number): Promise<void>;
    /**
     * Pause a track.
     */
    pause(reason?: string): Promise<void>;
    /**
     * Resume a track.
     */
    resume(reason?: string): Promise<void>;
    /**
     * Stop the player.
     */
    stop(): Promise<void>;
    /**
     * Set the queue's loop behavior.
     * @param type The loop type to use.
     */
    setLoop(type: LoopType): void;
    /**
     * Set the player's volume.
     * @param volume The volume to set the player to.
     */
    setVolume(volume: number): Promise<void>;
    /**
     * Set the player's filters.
     * @param filters The filters to use. An empty object clears filters.
     * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
     */
    setFilters(filters: Filters): Promise<void>;
    /**
     * Advance the queue.
     */
    private _advanceQueue;
    /**
     * Disconnect the bot from VC.
     */
    private _disconnect;
    /**
     * Get the bot's stage permissions.
     */
    private _getStagePermissions;
    /**
     * Handle the bot being moved.
     * @param newChannel The new voice channel ID.
     */
    private _handleMove;
    /**
     * Handle incoming payloads from the attached node.
     * @param payload The received payload.
     */
    private _handlePayload;
    /**
     * Helper function for sending play payloads to the server.
     * @param track The track to play.
     * @param options Options to use in the play payload.
     */
    private _play;
}
