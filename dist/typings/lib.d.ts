import { LavalinkManager as lavalinkManager } from '../structures/LavalinkManager';
import { Node as node } from '../structures/Node';
import { Player as player } from '../structures/Player';
import { Track as track, TrackPartial as trackPartial } from '../structures/Track';
declare namespace DiscordRoseLavalink {
    type LavalinkManager = lavalinkManager;
    type Node = node;
    type Player = player;
    type Track = track;
    type TrackPartial = trackPartial;
}
export = DiscordRoseLavalink;
