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
exports.Node = exports.NodeState = void 0;
const typed_emitter_1 = require("@jpbberry/typed-emitter");
const node_fetch_1 = __importStar(require("node-fetch"));
const url_1 = require("url");
const ws_1 = __importDefault(require("ws"));
var NodeState;
(function (NodeState) {
    NodeState[NodeState["DISCONNECTED"] = 0] = "DISCONNECTED";
    NodeState[NodeState["CONNECTING"] = 1] = "CONNECTING";
    NodeState[NodeState["RECONNECTING"] = 2] = "RECONNECTING";
    NodeState[NodeState["CONNECTED"] = 3] = "CONNECTED";
    NodeState[NodeState["DESTROYED"] = 4] = "DESTROYED";
})(NodeState = exports.NodeState || (exports.NodeState = {}));
class Node extends typed_emitter_1.EventEmitter {
    /**
     * Create a node.
     * @param options The options to use for the node.
     * @param identifier The node's identifier.
     * @param manager The node's manager.
     */
    constructor(options, identifier, manager) {
        super();
        this.identifier = identifier;
        this.manager = manager;
        /**
         * The node's state.
         */
        this.state = NodeState.DISCONNECTED;
        /**
         * The node's stats.
         */
        this.stats = {
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
        };
        /**
         * Incremented when reconnecting to compare to Node#options#maxRetrys.
         */
        this.reconnectAttempts = 0;
        /**
         * Used for delaying reconnection attempts.
         */
        this.reconnectTimeout = null;
        /**
         * The node's websocket.
         */
        this.ws = null;
        if (!options)
            throw new TypeError('Expected options to be defined');
        if (identifier === undefined)
            throw new TypeError('Expected identifier to be defined');
        if (!manager)
            throw new TypeError('Expected manager to be defined');
        this.options = {
            host: options.host ?? 'localhost',
            port: options.port ?? 2333,
            password: options.password ?? 'youshallnotpass',
            secure: options.secure ?? false,
            clientName: options.clientName ?? 'rose-lavalink',
            connectionTimeout: options.connectionTimeout ?? 15000,
            requestTimeout: options.requestTimeout ?? 15000,
            maxRetrys: options.maxRetrys ?? 10,
            retryDelay: options.retryDelay ?? 15000,
            defaultRequestOptions: options.defaultRequestOptions ?? {}
        };
        if (this.options.connectionTimeout > this.options.retryDelay)
            throw new Error('Node connection timeout must be greater than the reconnect retry delay');
        this.on('CONNECTED', (data) => this.manager.emit('NODE_CONNECTED', data));
        this.on('CREATED', (data) => this.manager.emit('NODE_CREATED', data));
        this.on('DESTROYED', (data) => this.manager.emit('NODE_DESTROYED', data));
        this.on('DISCONNECTED', (data) => this.manager.emit('NODE_DISCONNECTED', data));
        this.on('ERROR', (data) => this.manager.emit('NODE_ERROR', data));
        this.on('RAW', (data) => this.manager.emit('NODE_RAW', data));
        this.on('RECONNECTING', (data) => this.manager.emit('NODE_RECONNECTING', data));
        this.emit('CREATED', this);
    }
    /**
     * Connect the node to the lavalink server.
     */
    async connect() {
        if (this.state !== NodeState.DISCONNECTED && this.state !== NodeState.RECONNECTING)
            throw new Error('Cannot initiate a connection when the node isn\'t in a disconnected or reconnecting state');
        const headers = {
            Authorization: this.options.password,
            'User-Id': this.manager.worker.user.id,
            'Client-Name': this.options.clientName
        };
        return await new Promise((resolve, reject) => {
            const timedOut = setTimeout(() => {
                const error = new Error('Timed out while connecting to the lavalink server');
                this.emit('ERROR', { node: this, error });
                reject(error);
            }, this.options.connectionTimeout);
            this.ws = new ws_1.default(`ws${this.options.secure ? 's' : ''}://${this.options.host}:${this.options.port}/`, { headers });
            if (this.state !== NodeState.RECONNECTING)
                this.state = NodeState.CONNECTING;
            this.ws.once('error', (error) => {
                this.ws.removeAllListeners();
                this.ws = null;
                if (this.state !== NodeState.RECONNECTING)
                    this.state = NodeState.DISCONNECTED;
                this._onError(error);
                if (timedOut)
                    clearTimeout(timedOut);
                reject(error);
            });
            this.ws.once('open', () => {
                this.ws.removeAllListeners();
                this._onOpen();
                this.ws.on('open', this._onOpen.bind(this));
                this.ws.on('close', this._onClose.bind(this));
                this.ws.on('error', this._onError.bind(this));
                this.ws.on('message', this._onMessage.bind(this));
                if (timedOut)
                    clearTimeout(timedOut);
                resolve(undefined);
            });
        });
    }
    /**
     * Destroy the node and all attatched players.
     * @param reason The reason the node was destroyed.
     */
    destroy(reason = 'Manual destroy') {
        this.ws?.close(1000, 'destroy');
        this.ws?.removeAllListeners();
        this.ws = null;
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
            clearInterval(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.manager.players.filter((player) => player.node.identifier === this.identifier).forEach((player) => player.destroy('Attached node destroyed'));
        this.state = NodeState.DESTROYED;
        this.emit('DESTROYED', { node: this, reason });
        this.removeAllListeners();
        this.manager.nodes.delete(this.identifier);
    }
    /**
     * Send data to the lavalink server.
     * @param msg The data to send.
     */
    async send(msg) {
        if (this.state !== NodeState.CONNECTED)
            throw new Error('Cannot send payloads before a connection is established');
        return await new Promise((resolve, reject) => {
            this.ws?.send(JSON.stringify(msg), (error) => {
                if (error) {
                    this.emit('ERROR', { node: this, error });
                    reject(error);
                }
                else
                    resolve(true);
            });
        });
    }
    /**
     * Make a REST request.
     * @param method The method to use.
     * @param route The route to use.
     * @param options Request options.
     * @returns The response from the server.
     */
    async request(method, route, options = {}) {
        options = Object.assign(this.options.defaultRequestOptions ?? {}, options);
        const headers = new node_fetch_1.Headers();
        headers.set('Authorization', this.options.password);
        if (options.body)
            headers.set('Content-Type', 'application/json');
        if (options.headers)
            Object.keys(options.headers).forEach((key) => headers.set(key, options.headers?.[key]));
        return await new Promise((resolve, reject) => {
            const timedOut = setTimeout(() => reject(new Error('408 Timed out on request')), this.options.requestTimeout);
            node_fetch_1.default(`http${this.options.secure ? 's' : ''}://${this.options.host}:${this.options.port}/${route.replace(/^\//gm, '')}${options.query ? `?${new url_1.URLSearchParams(options.query).toString()}` : ''}`, {
                method, headers, body: options.body ? (options.parser ?? JSON.stringify)(options.body) : undefined, agent: options.agent ?? null, redirect: options.redirect ?? 'follow'
            }).then(async (res) => {
                const json = res.status === 204 ? null : await res.json();
                if (timedOut)
                    clearTimeout(timedOut);
                resolve({ res, json });
            }).catch((error) => {
                if (timedOut)
                    clearTimeout(timedOut);
                reject(error);
            });
        });
    }
    /**
     * Attempt to reconnect the node to the server.
     */
    reconnect() {
        this.state = NodeState.RECONNECTING;
        this.reconnectTimeout = setInterval(() => {
            if (this.options.maxRetrys !== 0 && this.reconnectAttempts >= this.options.maxRetrys) {
                this.emit('ERROR', { node: this, error: new Error(`Unable to reconnect after ${this.reconnectAttempts} attempts.`) });
                return this.destroy();
            }
            this.ws?.removeAllListeners();
            this.ws = null;
            this.state = NodeState.RECONNECTING;
            this.emit('RECONNECTING', this);
            this.connect().catch(() => this.reconnectAttempts++);
        }, this.options.retryDelay);
    }
    /**
     * Fired when the websocket emits an open event.
     */
    _onOpen() {
        if (this.reconnectTimeout) {
            clearInterval(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.state = NodeState.CONNECTED;
        this.emit('CONNECTED', this);
    }
    /**
     * Fired when the websocket emits a close event.
     * @param code The event's code.
     * @param reason The close reason.
     */
    _onClose(code, reason) {
        this.state = NodeState.DISCONNECTED;
        this.emit('DISCONNECTED', { node: this, code, reason: reason.length ? reason : 'No reason specified' });
        if (code !== 1000 && reason !== 'destroy')
            this.reconnect();
    }
    /**
     * Fired when the websocket emits an error event.
     * @param error The error thrown.
     */
    _onError(error) {
        if (!error)
            return;
        this.emit('ERROR', { node: this, error });
    }
    /**
     * Fired when the websocket receives a message payload
     * @param data The received data.
     */
    _onMessage(data) {
        if (Array.isArray(data))
            data = Buffer.concat(data);
        else if (data instanceof ArrayBuffer)
            data = Buffer.from(data);
        const payload = JSON.parse(data.toString());
        this.emit('RAW', { node: this, payload });
        switch (payload.op) {
            case 'event':
            case 'playerUpdate':
                break;
            case 'stats':
                delete payload.op;
                this.stats = { ...payload };
                break;
            default:
                this.emit('ERROR', { node: this, error: new Error(`Received unexpected op "${payload.op}"`) });
                break;
        }
    }
}
exports.Node = Node;
