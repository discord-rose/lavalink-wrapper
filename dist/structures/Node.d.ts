import { LavalinkManager } from '../typings/lib';
import { NodeStats } from '../typings/Lavalink';
import { EventEmitter } from '@jpbberry/typed-emitter';
import { RequestRedirect, Response } from 'node-fetch';
export interface CompleteNodeOptions {
    /**
     * The host for the node to use.
     * @default 'localhost'
     */
    host: string;
    /**
     * The port for the node to use.
     * @default 2333
     */
    port: number;
    /**
     * The password for the node to use.
     * @default 'youshallnotpass'
     */
    password: string;
    /**
     * If the connection is secure.
     * @default false
     */
    secure: boolean;
    /**
     * The client name to use.
     * @default 'rose-lavalink'
     */
    clientName: string;
    /**
     * A resume key to use when starting the node.
     * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#resuming-lavalink-sessions)
     */
    resumeKey?: string;
    /**
     * Data to configure resuming with.
     * If undefined resuming will not be configured.
     * @default undefined
     * @see [Lavalink Docs](https://github.com/freyacodes/Lavalink/blob/dev/IMPLEMENTATION.md#resuming-lavalink-sessions)
     */
    resumeKeyConfig?: {
        /**
         * The resume key.
         */
        key: string;
        /**
         * The time in milliseconds after the wrapper disconnects that the lavalink server's session should be closed anyways.
         */
        timeout: number;
    };
    /**
     * The time to wait before timing out a request.
     * @default 15000
     */
    requestTimeout: number;
    /**
     * The maximum number of times to try to connect or reconnect. Setting this to 0 removes the limit.
     * @default 10
     */
    maxRetrys: number;
    /**
     * The time in milliseconds to wait between connection or reconnection attempts.
     * This must be greater than the connection timeout.
     * @default 30000
     */
    retryDelay: number;
    /**
     * The amount of time to allow to connect to the lavalink server before timing out.
     * This must be less than the connect / reconnect retry delay.
     * @default 15000
     */
    connectionTimeout: number;
    /**
     * The default request options to use.
     */
    defaultRequestOptions: RequestOptions;
}
export interface NodeEvents {
    /**
     * Emitted when the node connects to the lavalink server.
     */
    CONNECTED: Node;
    /**
     * Emitted when the node is created.
     */
    CREATED: Node;
    /**
     * Emitted when the node is destroyed.
     */
    DESTROYED: {
        node: Node;
        reason: string;
    };
    /**
     * Emitted when the node disconnects from the lavalink server.
     */
    DISCONNECTED: {
        node: Node;
        code: number;
        reason: string;
    };
    /**
     * Emitted when the node encounters an error.
     */
    ERROR: {
        node: Node;
        error: Error;
    };
    /**
     * Emitted when the node receives a payload from the server.
     */
    RAW: {
        node: Node;
        payload: any;
    };
    /**
     * Emitted when the node is attempting to reconnect.
     */
    RECONNECTING: Node;
}
export interface NodeOptions extends Partial<CompleteNodeOptions> {
}
export declare enum NodeState {
    DISCONNECTED = 0,
    CONNECTING = 1,
    RECONNECTING = 2,
    CONNECTED = 3,
    DESTROYED = 4
}
export declare type RequestMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface RequestOptions {
    headers?: {
        [key: string]: string;
    };
    query?: any;
    body?: any;
    redirect?: RequestRedirect;
    agent?: any;
    parser?: (data: any) => string;
}
export declare class Node extends EventEmitter<NodeEvents> {
    identifier: number;
    manager: LavalinkManager;
    /**
     * The node's options.
     */
    readonly options: CompleteNodeOptions;
    /**
     * The node's state.
     */
    state: NodeState;
    /**
     * The node's stats.
     */
    stats: NodeStats;
    /**
     * Incremented when reconnecting to compare to Node#options#maxRetrys.
     */
    private reconnectAttempts;
    /**
     * Used for delaying reconnection attempts.
     */
    private reconnectTimeout;
    /**
     * The node's websocket.
     */
    private ws;
    /**
     * Create a node.
     * @param options The options to use for the node.
     * @param identifier The node's identifier.
     * @param manager The node's manager.
     */
    constructor(options: NodeOptions, identifier: number, manager: LavalinkManager);
    /**
     * Connect the node to the lavalink server.
     */
    connect(): Promise<void>;
    /**
     * Destroy the node and all attatched players.
     * @param reason The reason the node was destroyed.
     */
    destroy(reason?: string): void;
    /**
     * Send data to the lavalink server.
     * @param msg The data to send.
     */
    send(msg: any): Promise<boolean>;
    /**
     * Make a REST request.
     * @param method The method to use.
     * @param route The route to use.
     * @param options Request options.
     * @returns The response from the server.
     */
    request(method: RequestMethods, route: string, options?: RequestOptions): Promise<{
        res: Response;
        json: any;
    }>;
    /**
     * Attempt to reconnect the node to the server.
     */
    private reconnect;
    /**
     * Fired when the websocket emits an open event.
     */
    private _onOpen;
    /**
     * Fired when the websocket emits a close event.
     * @param code The event's code.
     * @param reason The close reason.
     */
    private _onClose;
    /**
     * Fired when the websocket emits an error event.
     * @param error The error thrown.
     */
    private _onError;
    /**
     * Fired when the websocket receives a message payload
     * @param data The received data.
     */
    private _onMessage;
}
