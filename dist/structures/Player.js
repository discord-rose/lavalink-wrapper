"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = exports.PlayerState = void 0;
const Track_1 = require("./Track");
const collection_1 = __importDefault(require("@discordjs/collection"));
const typed_emitter_1 = require("@jpbberry/typed-emitter");
const discord_rose_1 = require("discord-rose");
var PlayerState;
(function (PlayerState) {
    PlayerState[PlayerState["DISCONNECTED"] = 0] = "DISCONNECTED";
    PlayerState[PlayerState["CONNECTING"] = 1] = "CONNECTING";
    PlayerState[PlayerState["CONNECTED"] = 2] = "CONNECTED";
    PlayerState[PlayerState["PAUSED"] = 3] = "PAUSED";
    PlayerState[PlayerState["PLAYING"] = 4] = "PLAYING";
    PlayerState[PlayerState["DESTROYED"] = 5] = "DESTROYED";
})(PlayerState = exports.PlayerState || (exports.PlayerState = {}));
class Player extends typed_emitter_1.EventEmitter {
    /**
     * Create a player.
     * @param options The options to use for the player.
     * @param node The player's node.
     * @param manager The player's manager.
     */
    constructor(options, node, manager) {
        super();
        this.node = node;
        this.manager = manager;
        /**
         * The player's current voice channel.
         */
        this.currentVoiceChannel = null;
        /**
         * The player's filters.
         * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
         */
        this.filters = {};
        /**
         * If the player is a speaker. This is null if the player isn't connected, if the becomeSpeaker option is false, or if the channel is not a stage channel.
         * This is initially set when running Player#connect().
         */
        this.isSpeaker = null;
        /**
         * If the voice channel is a stage.
         * This is set when running Player#connect().
         */
        this.isStage = null;
        /**
         * The queue's loop behavior.
         */
        this.loop = 'off';
        /**
         * The position in the track playing, in milliseconds.
         * This is null if no track is playing.
         */
        this.position = null;
        /**
         * The queue.
         */
        this.queue = [];
        /**
         * The current song playing, represented as an index of Player#queue. This is null if there isn't a song currently playing.
         */
        this.queuePosition = null;
        /**
         * The player's state.
         */
        this.state = PlayerState.DISCONNECTED;
        /**
         * The player's volume.
         */
        this.volume = 100;
        /**
         * A helper variable for setting the player's state after sending a play op with pause set to true.
         */
        this.sentPausedPlay = null;
        if (!options)
            throw new TypeError('Expected options to be defined');
        if (!manager)
            throw new TypeError('Expected manager to be defined');
        if (!options.guildId)
            throw new TypeError('Expected options.guildId to be defined');
        if (!options.textChannelId)
            throw new TypeError('Expected options.textChannelId to be defined');
        if (!options.voiceChannelId)
            throw new TypeError('Expected options.voiceChannelId to be defined');
        if (manager.players.has(options.guildId))
            throw new Error('A player with the specified guild ID is already defined');
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
        };
        this.node.on('RAW', this._handlePayload.bind(this));
        this.on('CONNECTED', (data) => this.manager.emit('PLAYER_CONNECTED', data));
        this.on('CREATED', (data) => this.manager.emit('PLAYER_CREATED', data));
        this.on('DESTROYED', (data) => this.manager.emit('PLAYER_DESTROYED', data));
        this.on('ERROR', (data) => this.manager.emit('PLAYER_ERROR', data));
        this.on('MOVED', (data) => this.manager.emit('PLAYER_MOVED', data));
        this.on('TRACK_END', (data) => this.manager.emit('PLAYER_TRACK_END', data));
        this.on('TRACK_EXCEPTION', (data) => this.manager.emit('PLAYER_TRACK_EXCEPTION', data));
        this.on('TRACK_START', (data) => this.manager.emit('PLAYER_TRACK_START', data));
        this.on('TRACK_STUCK', (data) => this.manager.emit('PLAYER_TRACK_STUCK', data));
        this.emit('CREATED', this);
    }
    /**
     * Connect to a voice channel.
     * The player must be in a disconnected state.
     */
    async connect() {
        if (this.state !== PlayerState.DISCONNECTED)
            throw new Error('Cannot initiate a connection when the player isn\'t in a disconnected state');
        // @ts-expect-error Property 'ws' is private and only accessible within class 'Shard'.
        void this.manager.worker.guildShard(this.options.guildId).ws._send({
            op: 4,
            d: {
                guild_id: this.options.guildId,
                channel_id: this.options.voiceChannelId,
                self_mute: this.options.selfMute,
                self_deafen: this.options.selfDeafen
            }
        });
        this.state = PlayerState.CONNECTING;
        return await new Promise((resolve, reject) => {
            const timedOut = setTimeout(() => {
                const error = new Error('Timed out while connecting to the voice channel');
                this.emit('ERROR', { player: this, error });
                reject(error);
            }, this.options.connectionTimeout);
            const onConnect = async () => {
                this.removeListener('DESTROYED', onDestroy);
                if (this.options.becomeSpeaker) {
                    const voiceChannel = await this.manager.worker.api.channels.get(this.options.voiceChannelId);
                    if (voiceChannel.type === 13 /* GuildStageVoice */) {
                        this.isStage = true;
                        this.isSpeaker = false;
                        const permissions = await this._getStagePermissions();
                        if (permissions.becomeSpeaker) {
                            await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                                body: { channel_id: this.options.voiceChannelId, suppress: false }
                            });
                            this.isSpeaker = true;
                        }
                        else if (permissions.request) {
                            await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                                body: { channel_id: this.options.voiceChannelId, request_to_speak_timestamp: new Date().toISOString() }
                            });
                        }
                        else {
                            if (this.currentVoiceChannel)
                                void this._disconnect();
                            const error = new Error('Failed to connect to the stage channel, the bot does not have permissions to request to or become a speaker');
                            this.emit('ERROR', { player: this, error });
                            if (timedOut)
                                clearTimeout(timedOut);
                            reject(error);
                        }
                    }
                    else
                        this.isStage = false;
                }
                if (timedOut)
                    clearTimeout(timedOut);
                resolve(undefined);
            };
            const onDestroy = (data) => {
                this.removeListener('CONNECTED', onConnect);
                if (this.currentVoiceChannel)
                    void this._disconnect();
                const error = new Error(`Failed to connect to the voice channel, Player was destroyed: ${data.reason}`);
                this.emit('ERROR', { player: this, error });
                reject(error);
            };
            this.once('CONNECTED', onConnect);
            this.once('DESTROYED', onDestroy);
        });
    }
    /**
     * Destroy the player.
     * @param reason The reason the player was destroyed.
     */
    destroy(reason = 'Manual destroy') {
        this.node.removeListener('RAW', this._handlePayload);
        if (this.currentVoiceChannel)
            void this._disconnect();
        void this.node.send({
            op: 'destroy',
            guildId: this.options.guildId
        });
        this.queue = [];
        this.queuePosition = null;
        this.position = null;
        this.state = PlayerState.DESTROYED;
        this.emit('DESTROYED', { player: this, reason });
        this.removeAllListeners();
        this.manager.players.delete(this.options.guildId);
    }
    /**
     * Queue and play a track or tracks.
     * If a track is already playing, the specified track(s) will only be pushed to the queue.
     * @param track The track or track partial to queue and play.
     * @param options Play options.
     * @returns The track played.
     */
    async play(track, options) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot play when the player isn\'t in a connected, paused, or playing state');
        if (track instanceof Array)
            this.queue.push(...track);
        else
            this.queue.push(track);
        if (this.state === PlayerState.CONNECTED) {
            const newPosition = track instanceof Array ? this.queue.length - track.length : this.queue.length - 1;
            if (this.queue[newPosition] instanceof Track_1.TrackPartial)
                this.queue[newPosition] = await this.manager.resolveTrack(this.queue[newPosition]);
            if (!(this.queue[newPosition] instanceof Track_1.Track) || !this.queue[newPosition].track)
                throw new TypeError('Invalid track');
            await this._play(this.queue[newPosition], options);
            this.queuePosition = newPosition;
        }
    }
    /**
     * Skip to the next track based on the player's loop behavior, or to a specified index of the queue.
     * @param index The index to skip to.
     */
    async skip(index) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot skip when the player isn\'t in a connected, paused, or playing state');
        await this._stop();
        if (typeof index === 'number') {
            if (index < 0 || index >= this.queue.length)
                throw new Error('Invalid index');
            if (this.queue[index] instanceof Track_1.TrackPartial)
                this.queue[index] = await this.manager.resolveTrack(this.queue[index]);
            if (!(this.queue[index] instanceof Track_1.Track) || !this.queue[index].track)
                throw new TypeError('Invalid track');
            await this._play(this.queue[index]);
            this.queuePosition = index;
        }
        else
            await this._advanceQueue();
    }
    /**
     * Shuffles the queue and starts playing the first track.
     */
    async shuffle() {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot shuffle when the player isn\'t in a connected, paused, or playing state');
        await this._stop();
        let currentIndex = this.queue.length;
        let randomIndex = 0;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [this.queue[currentIndex], this.queue[randomIndex]] = [this.queue[randomIndex], this.queue[currentIndex]];
        }
        if (this.queue[0] instanceof Track_1.TrackPartial)
            this.queue[0] = await this.manager.resolveTrack(this.queue[0]);
        if (!(this.queue[0] instanceof Track_1.Track) || !(this.queue[0]).track)
            throw new Error('Invalid track at new queue position 0');
        await this._play(this.queue[0]);
        this.queuePosition = 0;
    }
    /**
     * Seek to a desired position.
     * @param position The position in the track to seek to, in milliseconds.
     */
    async seek(position) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot seek when the player isn\'t in a connected, paused, or playing state');
        if (typeof position !== 'number')
            throw new TypeError('Expected position to be defined');
        if (position < 0)
            throw new Error('Position must be greater than 0');
        await this.node.send({
            op: 'seek',
            guildId: this.options.guildId,
            position
        });
    }
    /**
     * Pause a track.
     */
    async pause(reason = 'Manual Pause') {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot pause when the player isn\'t in a connected, paused, or playing state');
        await this.node.send({
            op: 'pause',
            guildId: this.options.guildId,
            pause: true
        });
        this.state = PlayerState.PAUSED;
        this.emit('PAUSED', { player: this, reason });
    }
    /**
     * Resume a track.
     */
    async resume(reason = 'Manual Resume') {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot resume when the player isn\'t in a connected, paused, or playing state');
        await this.node.send({
            op: 'pause',
            guildId: this.options.guildId,
            pause: false
        });
        this.state = PlayerState.PLAYING;
        this.emit('RESUMED', { player: this, reason });
    }
    /**
     * Stop the player.
     */
    async stop() {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot stop when the player isn\'t in a connected, paused, or playing state');
        await this._stop();
        this.queuePosition = null;
    }
    /**
     * Set the queue's loop behavior.
     * @param type The loop type to use.
     */
    setLoop(type) {
        this.loop = type;
    }
    /**
     * Set the player's volume.
     * @param volume The volume to set the player to.
     */
    async setVolume(volume) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot set volume when the player isn\'t in a connected, paused, or playing state');
        if (volume < 0 || volume > 1000)
            throw new Error('Volume must be between 0 and 1000');
        this.volume = volume;
        await this.node.send({
            op: 'volume',
            guildId: this.options.guildId,
            volume
        });
    }
    /**
     * Set the player's filters.
     * @param filters The filters to use. An empty object clears filters.
     * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#using-filters)
     */
    async setFilters(filters) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot set filters when the player isn\'t in a connected, paused, or playing state');
        if (!filters)
            throw new TypeError('Expected filters to be defined');
        await this.node.send(Object.assign({
            op: 'filters',
            guildId: this.options.guildId
        }, filters));
        this.filters = filters;
    }
    /**
     * Advance the queue.
     */
    async _advanceQueue() {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            return void this.emit('ERROR', { player: this, error: new Error('Cannot advance the queue when the player isn\'t in a connected, paused, or playing state') });
        if (this.queuePosition === null)
            this.queuePosition = 0;
        else {
            if (this.loop !== 'single')
                this.queuePosition++;
            if (!this.queue[this.queuePosition] && this.loop === 'queue')
                this.queuePosition = 0;
        }
        if (this.queue[this.queuePosition]) {
            if (this.queue[this.queuePosition] instanceof Track_1.TrackPartial)
                this.queue[this.queuePosition] = await this.manager.resolveTrack(this.queue[this.queuePosition]);
            if (!(this.queue[this.queuePosition] instanceof Track_1.Track) || !this.queue[this.queuePosition].track) {
                this.emit('ERROR', { player: this, error: new Error('Unable to get Track from new queue position while advancing the queue') });
                if (this.loop === 'single')
                    this.queuePosition++;
                await this._advanceQueue();
                return;
            }
            this._play(this.queue[this.queuePosition]).catch(async (error) => {
                this.emit('ERROR', { player: this, error });
                if (this.loop === 'single')
                    this.queuePosition++;
                await this._advanceQueue();
            });
        }
        else
            this.queuePosition = null;
    }
    /**
     * Disconnect the bot from VC.
     */
    async _disconnect() {
        // @ts-expect-error Property 'ws' is private and only accessible within class 'Shard'.
        await this.manager.worker.guildShard(this.options.guildId).ws._send({
            op: 4,
            d: {
                guild_id: this.options.guildId,
                channel_id: null,
                self_mute: false,
                self_deafen: false
            }
        });
        this.currentVoiceChannel = null;
        this.state = PlayerState.DISCONNECTED;
    }
    /**
     * Get the bot's stage permissions.
     */
    async _getStagePermissions() {
        const voiceChannel = await this.manager.worker.api.channels.get(this.options.voiceChannelId);
        const guild = await this.manager.worker.api.guilds.get(this.options.guildId);
        const botPerms = discord_rose_1.PermissionsUtils.combine({
            guild,
            member: await this.manager.worker.api.members.get(guild.id, this.manager.worker.user.id),
            overwrites: voiceChannel.permission_overwrites,
            roleList: guild.roles.reduce((p, c) => p.set(c.id, c), new collection_1.default())
        });
        return {
            becomeSpeaker: discord_rose_1.PermissionsUtils.has(botPerms, 'mute'),
            request: discord_rose_1.PermissionsUtils.has(botPerms, 'requestToSpeak')
        };
    }
    /**
     * Handle the bot being moved.
     * @param newChannel The new voice channel ID.
     */
    async _handleMove(newChannel, data) {
        if (newChannel !== this.currentVoiceChannel)
            this.emit('MOVED', { player: this, oldChannel: this.currentVoiceChannel, newChannel });
        const wasCorrect = this.options.voiceChannelId === this.currentVoiceChannel;
        const nowCorrect = this.options.voiceChannelId === newChannel;
        const wasSuppressed = this.lastVoiceState?.suppress ?? false;
        const nowSuppressed = data.suppress;
        if (this.state === PlayerState.CONNECTED || this.state === PlayerState.PAUSED || this.state === PlayerState.PLAYING) {
            if (this.options.moveBehavior === 'destroy' && (!nowCorrect || newChannel === null))
                return this.destroy('Player was moved out of the voice channel');
            else if (this.options.moveBehavior === 'pause') {
                if (this.state === PlayerState.PAUSED && !wasCorrect && nowCorrect)
                    void this.resume('Moved into the voice channel');
                else if (this.state === PlayerState.PLAYING && wasCorrect && !nowCorrect)
                    void this.pause('Moved out of the voice channel');
            }
            if (this.isStage && this.options.becomeSpeaker && this.lastVoiceState) {
                this.isSpeaker = !nowSuppressed;
                if (this.options.stageMoveBehavior === 'destroy' && !wasSuppressed && nowSuppressed)
                    return this.destroy('Player was moved to the audience');
                else if (this.options.stageMoveBehavior === 'pause') {
                    if (this.state === PlayerState.PAUSED && wasSuppressed && !nowSuppressed)
                        void this.resume('Became a speaker');
                    else if (this.state === PlayerState.PLAYING && !wasSuppressed && nowSuppressed) {
                        void this.pause('Moved to the audience');
                        const permissions = await this._getStagePermissions();
                        if (permissions.request) {
                            await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                                body: { channel_id: this.options.voiceChannelId, request_to_speak_timestamp: new Date().toISOString() }
                            });
                        }
                        else if (permissions.becomeSpeaker) {
                            await this.manager.worker.api.request('PATCH', `/guilds/${this.options.guildId}/voice-states/@me`, {
                                body: { channel_id: this.options.voiceChannelId, suppress: false }
                            });
                        }
                    }
                }
            }
        }
        else if (this.state === PlayerState.CONNECTING) {
            if (nowCorrect) {
                this.state = PlayerState.CONNECTED;
                this.emit('CONNECTED', this);
            }
            else
                this.destroy('Connected to incorrect channel');
        }
        this.currentVoiceChannel = newChannel;
        this.lastVoiceState = data;
    }
    /**
     * Handle incoming payloads from the attached node.
     * @param payload The received payload.
     */
    async _handlePayload({ node, payload }) {
        if (payload.op === 'playerUpdate') {
            this.position = payload.state.position ?? null;
        }
        else if (payload.op === 'event') {
            const track = typeof payload.track === 'string' ? (await this.manager.decodeTracks([payload.track]))[0] : null;
            // @ts-expect-error Cannot assign to 'requester' because it is a read-only property.
            if (track)
                track.requester = this.queue[this.queuePosition] && this.queue[this.queuePosition].title === track.title ? this.queue[this.queuePosition].requester : this.queue.find((v) => v.title === track.title);
            switch (payload.type) {
                case 'TrackEndEvent':
                    this.position = null;
                    this.state = PlayerState.CONNECTED;
                    this.emit('TRACK_END', { player: this, track, reason: payload.reason });
                    if (payload.reason !== 'STOPPED' && payload.reason !== 'REPLACED')
                        void this._advanceQueue();
                    break;
                case 'TrackExceptionEvent':
                    this.emit('TRACK_EXCEPTION', { player: this, track, message: payload.exception.message, severity: payload.exception.severity, cause: payload.exception.cause });
                    break;
                case 'TrackStartEvent':
                    if (this.sentPausedPlay) {
                        this.state = PlayerState.PAUSED;
                        this.sentPausedPlay = null;
                    }
                    else
                        this.state = PlayerState.PLAYING;
                    this.emit('TRACK_START', { player: this, track });
                    break;
                case 'TrackStuckEvent':
                    this.emit('TRACK_STUCK', { player: this, track, thresholdMs: payload.thresholdMs });
                    await this._stop().catch(() => { });
                    void this._advanceQueue();
                    break;
            }
        }
    }
    /**
     * Helper function for sending play payloads to the server.
     * @param track The track to play.
     * @param options Options to use in the play payload.
     */
    async _play(track, options) {
        if (this.state !== PlayerState.CONNECTED && this.state !== PlayerState.PAUSED && this.state !== PlayerState.PLAYING)
            throw new Error('Cannot play when the player isn\'t in a connected, paused, or playing state');
        if (typeof options?.volume === 'number') {
            if (options.volume < 0 || options.volume > 1000)
                throw new Error('Volume must be between 0 and 1000');
            this.volume = options.volume;
            if (options.volume === 100)
                delete options.volume;
        }
        else if (this.volume !== 100)
            options = Object.assign(options ?? {}, { volume: this.volume });
        if (this.isStage && !this.isSpeaker)
            options = Object.assign(options ?? {}, { pause: true });
        if (options?.pause)
            this.sentPausedPlay = true;
        await this.node.send(Object.assign({
            op: 'play',
            guildId: this.options.guildId,
            track: track.track
        }, options));
    }
    /**
     * Helper function for sending stop payloads to the server.
     */
    async _stop() {
        await this.node.send({
            op: 'stop',
            guildId: this.options.guildId
        });
        this.position = null;
        this.state = PlayerState.CONNECTED;
    }
}
exports.Player = Player;
