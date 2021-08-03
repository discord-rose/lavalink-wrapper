"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LavalinkManager = void 0;
const Node_1 = require("./Node");
const Player_1 = require("./Player");
const Track_1 = require("./Track");
const Constants_1 = __importDefault(require("../util/Constants"));
const collection_1 = __importDefault(require("@discordjs/collection"));
const typed_emitter_1 = require("@jpbberry/typed-emitter");
const node_fetch_1 = __importStar(require("node-fetch"));
class LavalinkManager extends typed_emitter_1.EventEmitter {
    /**
     * Create a lavalink manager.
     * @param options The options to use for the manager.
     * @param worker The manager's worker.
     */
    constructor(options, worker) {
        super();
        this.worker = worker;
        /**
         * The manager's nodes.
         */
        this.nodes = new collection_1.default();
        /**
         * The manager's players.
         */
        this.players = new collection_1.default();
        /**
         * The manager's spotify token.
         * Set when running LavalinkManager#connectNodes().
         */
        this.spotifyToken = null;
        if (!options)
            throw new TypeError('Expected options to be defined');
        if (!worker)
            throw new TypeError('Expected worker to be defined');
        if (!options.nodeOptions?.length)
            throw new Error('At least 1 node must be defined');
        if (options.enabledSources && options.defaultSource && !options.enabledSources.includes(options.defaultSource))
            throw new Error('Default source must be defined in enabled sources');
        if (options.spotifyAuth && (!options.spotifyAuth.clientId || !options.spotifyAuth.clientSecret))
            throw new Error('Spotify auth is not properly defined');
        for (const [i, nodeOption] of options.nodeOptions.entries())
            this.nodes.set(i, new Node_1.Node(nodeOption, i, this));
        this.options = {
            nodeOptions: options.nodeOptions,
            enabledSources: options.enabledSources ?? ['youtube', 'soundcloud'],
            leastLoadSort: options.leastLoadSort ?? 'system',
            defaultSource: options.defaultSource ?? 'youtube',
            spotifyAuth: options.spotifyAuth
        };
        this.worker.on('VOICE_SERVER_UPDATE', (data) => this._handleVoiceUpdate('VOICE_SERVER_UPDATE', data));
        this.worker.on('VOICE_STATE_UPDATE', (data) => this._handleVoiceUpdate('VOICE_STATE_UPDATE', data));
    }
    /**
     * Nodes sorted by cpu load.
     */
    get leastLoadNodes() {
        return this.nodes
            .reduce((p, v) => p.concat(v), [])
            .filter((node) => node.state === Node_1.NodeState.CONNECTED)
            .sort((a, b) => (a.stats.cpu ? a.stats.cpu[this.options.leastLoadSort === 'system' ? 'systemLoad' : 'lavalinkLoad'] / a.stats.cpu.cores : 0) - (b.stats.cpu ? b.stats.cpu[this.options.leastLoadSort === 'system' ? 'systemLoad' : 'lavalinkLoad'] / b.stats.cpu.cores : 0));
    }
    /**
     * Connect all nodes to their server.
     * @returns The results of node connection attempts.
     */
    async connectNodes() {
        if (this.options.spotifyAuth)
            void this._renewSpotifyLoop();
        const connect = [];
        this.nodes.forEach((node) => connect.push(new Promise((resolve, reject) => {
            let attempts = 0;
            const tryConnect = async () => {
                if (node.options.maxRetrys !== 0 && attempts >= node.options.maxRetrys) {
                    node.emit('ERROR', { node, error: new Error(`Unable to connect after ${attempts} attempts`) });
                    if (connectInterval)
                        clearInterval(connectInterval);
                    reject(new Error('Max connect retrys reached'));
                }
                await node.connect().catch(() => attempts++);
                if (node.state === Node_1.NodeState.CONNECTED) {
                    if (connectInterval)
                        clearInterval(connectInterval);
                    resolve(node);
                }
            };
            tryConnect();
            const connectInterval = setInterval(tryConnect, node.options.retryDelay);
        })));
        return await Promise.allSettled(connect);
    }
    /**
     * Create a new player.
     * @param options The player's options.
     * @returns The created player.
     */
    createPlayer(options) {
        if (!options?.guildId)
            throw new TypeError('Expected options.guildId to be defined');
        if (this.players.get(options.guildId))
            throw new Error('A player already exists for that guild');
        if (!this.leastLoadNodes[0])
            throw new Error('No available nodes to bind the player to');
        const player = new Player_1.Player(options, this.leastLoadNodes[0], this);
        this.players.set(options.guildId, player);
        return player;
    }
    /**
     * Get search results based on a query.
     * If the query is a link, it will attempt to get a track from the link. If not, it will return results from a search using the specified or default source.
     * If spotify auth is defined in the manager config, spotify links will resolve into youtube tracks.
     * @param query The query to search with.
     * @param requester The user that requsted the track. This value is not crucial.
     * @param source The source to use if the query is not a link, or if the link is from spotify. Defaults to the manager's default source.
     * @returns The search result.
     */
    async search(query, requester, source = this.options.defaultSource) {
        const searchNode = this.leastLoadNodes[0];
        if (!searchNode)
            throw new Error('No available nodes to perform a search');
        if (!this.options.enabledSources?.includes(source))
            throw new Error('The provided source is not enabled');
        const spotifyMatch = query.match(Constants_1.default.SPOTIFY_REGEX) ?? [];
        if (this.spotifyToken && ['album', 'playlist', 'track'].includes(spotifyMatch[1])) {
            const headers = new node_fetch_1.Headers();
            headers.set('Authorization', this.spotifyToken);
            headers.set('Content-Type', 'application/json');
            if (spotifyMatch[1] === 'album' || spotifyMatch[1] === 'playlist') {
                const res = await node_fetch_1.default(`${Constants_1.default.SPOTIFY_BASE_URL}/${spotifyMatch[1]}s/${spotifyMatch[2]}`, Object.assign(Object.assign({}, this.options.defaultSpotifyRequestOptions ?? {}), {
                    method: 'GET', headers
                }));
                const data = await res.json();
                if (!data?.tracks?.items?.length) {
                    return {
                        loadType: 'LOAD_FAILED',
                        tracks: [],
                        exception: {
                            message: `No spotify tracks found: HTTP Code ${res.status}`,
                            severity: 'COMMON'
                        }
                    };
                }
                const tracks = data.tracks.items.map((t) => new Track_1.TrackPartial((t.track ?? t).name, requester, (t.track ?? t).artists.map((a) => a.name).join(', '), (t.track ?? t).duration_ms));
                let next = data.tracks.next;
                while (next) {
                    const nextRes = await node_fetch_1.default(next, Object.assign(Object.assign({}, this.options.defaultSpotifyRequestOptions ?? {}), {
                        method: 'GET', headers
                    }));
                    const nextData = await nextRes.json();
                    if (nextData?.items?.length)
                        tracks.push(...nextData.items.map((t) => new Track_1.TrackPartial((t.track ?? t).name, requester, (t.track ?? t).artists.map((a) => a.name).join(', '), (t.track ?? t).duration_ms)));
                    if (nextData?.next)
                        next = nextData.next;
                    else
                        next = null;
                }
                return {
                    loadType: 'PLAYLIST_LOADED',
                    tracks: tracks,
                    playlistInfo: {
                        name: data.name,
                        selectedTrack: null
                    }
                };
            }
            else {
                const res = await node_fetch_1.default(`${Constants_1.default.SPOTIFY_BASE_URL}/${spotifyMatch[1]}s/${spotifyMatch[2]}`, Object.assign(Object.assign({}, this.options.defaultSpotifyRequestOptions ?? {}), {
                    method: 'GET', headers
                }));
                const data = await res.json();
                return {
                    loadType: 'TRACK_LOADED',
                    tracks: [new Track_1.TrackPartial(data.name, requester, data.artists.map((a) => a.name).join(', '), data.duration_ms)]
                };
            }
        }
        else {
            const res = await searchNode.request('GET', '/loadtracks', { query: { identifier: Constants_1.default.URL_REGEX.test(query) ? query : `${Constants_1.default.SOURCE_IDENTIFIERS[source]}search:${query}` } });
            if (!res?.json)
                throw new Error('No search response data');
            const searchResult = {
                loadType: res.json.loadType,
                tracks: res.json.tracks.map((data) => new Track_1.Track(data, requester)),
                exception: res.json.exception
            };
            if (res.json.playlistInfo) {
                searchResult.playlistInfo = {
                    name: res.json.playlistInfo.Name,
                    selectedTrack: typeof res.json.playlistInfo.selectedTrack === 'number' ? searchResult.tracks[res.json.playlistInfo.selectedTrack] : null
                };
            }
            return searchResult;
        }
    }
    /**
     * Decode track strings into an array of tracks.
     * @param tracks The tracks encoded in base64.
     * @returns An array of the decoded tracks.
     */
    async decodeTracks(tracks) {
        const decodeNode = this.leastLoadNodes[0];
        if (!decodeNode)
            throw new Error('No available nodes to decode the track');
        const res = await decodeNode.request('POST', '/decodetracks', { body: tracks });
        if (!res?.json)
            throw new Error('No decode response data');
        return res.json.map((data) => new Track_1.Track(data, 'N/A'));
    }
    /**
     * Resolve a track partial into a track.
     * @param track The track partial to resolve.
     * @returns The resolved track.
     */
    async resolveTrack(track) {
        const search = await this.search(`${track.title}${track.author ? ` - ${track.author}` : ''}`, track.requester);
        search.tracks = search.tracks.filter((t) => t instanceof Track_1.Track);
        if (search.loadType !== 'SEARCH_RESULT' || !search.tracks.length)
            throw new Error('No results found');
        if (track.author) {
            const sameAuthor = search.tracks.filter((t) => [track.author ?? '', `${track.author ?? ''} - Topic`].some((name) => new RegExp(`^${name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(t.author ?? '') ?? new RegExp(`^${name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(t.title ?? '')));
            if (sameAuthor.length)
                return sameAuthor[0];
        }
        if (track.length) {
            const sameDuration = search.tracks.filter(t => t.length &&
                (t.length >= ((track.length ?? 0) - 2000)) &&
                (t.length <= ((track.length ?? 0) + 200)));
            if (sameDuration.length)
                return sameDuration[0];
        }
        return search.tracks[0];
    }
    /**
     * Handle voice state update data.
     * @param event The emitted event.
     * @param data Data from the event.
     */
    _handleVoiceUpdate(event, data) {
        if (!data.guild_id)
            return;
        const player = this.players.get(data.guild_id);
        if (!player)
            return;
        if (event === 'VOICE_STATE_UPDATE') {
            if (data.user_id !== this.worker.user.id)
                return;
            // @ts-expect-error Property '_handleMove' is private and only accessible within class 'Player'
            void player._handleMove(data.channel_id, data);
        }
        else if (event === 'VOICE_SERVER_UPDATE') {
            player.node.send({
                op: 'voiceUpdate',
                guildId: player.options.guildId,
                // @ts-expect-error Property 'ws' is private and only accessible within class 'Shard'.
                sessionId: this.worker.guildShard(player.options.guildId).ws.sessionID,
                event: data
            }).catch(() => { });
        }
    }
    /**
     * Authorize with Spotify.
     * @returns The time the token is valid for in milliseconds.
     */
    async _authorizeSpotify() {
        if (!this.options.spotifyAuth)
            throw new Error('Spotify auth must be defined');
        const headers = new node_fetch_1.Headers();
        headers.set('Authorization', `Basic ${Buffer.from(`${this.options.spotifyAuth.clientId}:${this.options.spotifyAuth.clientSecret}`).toString('base64')}`);
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        const res = await node_fetch_1.default(Constants_1.default.SPOTIFY_TOKEN_ENDPOINT, Object.assign(Object.assign({}, this.options.defaultSpotifyRequestOptions ?? {}), {
            method: 'POST',
            headers,
            body: 'grant_type=client_credentials'
        }));
        const data = await res.json();
        if (!data?.access_token)
            throw new Error('Invalid Spotify authentication');
        this.spotifyToken = `Bearer ${data.access_token}`;
        this.emit('SPOTIFY_AUTHORIZED', { expiresIn: data.expires_in * 1000, token: this.spotifyToken });
        return data.expires_in * 1000;
    }
    /**
     * A helper function to loop renewing spotify tokens.
     */
    async _renewSpotifyLoop() {
        setTimeout(() => void this._renewSpotifyLoop(), await new Promise((resolve, reject) => {
            const auth = () => void this._authorizeSpotify().then((time) => resolve(time)).catch((error) => {
                this.emit('SPOTIFY_AUTH_ERROR', error);
                auth();
            });
            auth();
        }));
    }
}
exports.LavalinkManager = LavalinkManager;
