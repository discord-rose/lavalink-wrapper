# @discord-rose/lavalink
## A lavalink wrapper with native bindings to discord-rose.

# Installation
Run `npm i --save @discord-rose/lavalink`

# Example bot
**./master.js**
```js
const { Master } = require('discord-rose')
const path = require('path')

const master = new Master(path.resolve(__dirname, './worker.js'), {
  token: 'BOT TOKEN'
})

master.start()
```
**./worker.js**
```js
const { Worker } = require('discord-rose')
const { LavalinkManager } = require('@discord-rose/lavalink')

// Define your lavalink nodes.
const nodes = [{
  host: 'localhost',
  port: 2333,
  password: 'youshallnotpass'
}]

const worker = new Worker()

// Create a new lavalink manager.
const lavalink = new LavalinkManager({ nodeOptions: nodes }, worker)

worker.on('READY', async () => {
  // Connect your lavalink nodes.
  await lavalink.connectNodes()
  worker.log('Lavalink ready!')
})

worker.commands
  .prefix('!')
  .error((ctx, error) => ctx.reply(`Oops! I got an error: ${error.message}`))
  .add({
    command: 'play',
    exec: async (ctx) => {
      // The 2 lines below assume you are caching voiceStates to find the invoking user's voice channel.
      const foundVoiceState = ctx.worker.voiceStates.find((state) => state.guild_id === ctx.message.guild_id && state.users.has(ctx.author.id))
      if (!foundVoiceState) return ctx.error(`You must be in a voice channel to play music.`)

      // Search based on arguments.
      if (!ctx.args.length) return ctx.error('You must specify a search query!')
      const search = await lavalink.search(ctx.args.join(' '), ctx.author.id)
      if (!search.tracks[0]) return ctx.error(`Unable to find any results based on the provided query.`)

      // Get the guild's player if it exists, or create a new one.
      const player = lavalink.players.get(ctx.message.guild_id) ?? lavalink.createPlayer({
        guildId: ctx.message.guild_id,
        voiceChannelId: foundVoiceState.channel_id,
        textChannelId: ctx.message.channel_id
      });

      // Connect to the voice channel if the bot is disconnected.
      if (player.state === 0) await player.connect();

      // Play the first search result.
      // If the search result is a playlist, the playlist is pushed to the queue and the first song in the playlist is played.
      await player.play(search.loadType === `PLAYLIST_LOADED` ? search.tracks : search.tracks[0])
      return ctx.send('Playing music!')
    }
  })
```