/* eslint-disable @typescript-eslint/no-namespace */

import { LavalinkManager as lavalinkManager } from '../structures/LavalinkManager'
import { Node as node } from '../structures/Node'
import { Player as player } from '../structures/Player'
import { Track as track, TrackPartial as trackPartial } from '../structures/Track'

namespace DiscordRoseLavalink {
  export type LavalinkManager = lavalinkManager
  export type Node = node
  export type Player = player
  export type Track = track
  export type TrackPartial = trackPartial
}

export = DiscordRoseLavalink
