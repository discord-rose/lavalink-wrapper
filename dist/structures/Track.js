"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Track = exports.TrackPartial = void 0;
/**
 * Track partial - represents an unresolved track.
 */
class TrackPartial {
    /**
     * Create a track partial.
     * @param title The track's title.
     * @param requester The track's requester.
     * @param author The track's author.
     * @param length The track's length in milliseconds.
     */
    constructor(title, requester, author, length) {
        this.title = title;
        this.requester = requester;
        this.author = author;
        this.length = length;
    }
}
exports.TrackPartial = TrackPartial;
class Track {
    /**
     * Create a new track.
     * @param data Track data from the server.
     * @param requester The track's requester.
     */
    constructor(data, requester) {
        this.requester = requester;
        if (!data)
            throw new TypeError('Expected data to be defined');
        this.track = data.track;
        for (const info in data.info)
            this[info] = data.info[info];
    }
    /**
     * Get the track's thumbnail. This is only supported by tracks with sourceName = 'youtube'.
     * @param resolution The thumbnail resolution.
     * @returns The track's thumbnail, if available.
     */
    thumbnail(resolution) {
        if (this.sourceName === 'youtube')
            return `https://img.youtube.com/vi/${this.identifier}/${resolution}.jpg`;
    }
}
exports.Track = Track;
