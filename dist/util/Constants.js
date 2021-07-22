"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    SOURCE_IDENTIFIERS: {
        youtube: 'yt',
        spotify: 'sc'
    },
    URL_REGEX: /^https?:\/\//,
    SPOTIFY_REGEX: /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|album)[/:]([A-Za-z0-9]+)/,
    SPOTIFY_BASE_URL: 'https://api.spotify.com/v1',
    SPOTIFY_TOKEN_ENDPOINT: 'https://accounts.spotify.com/api/token'
};
