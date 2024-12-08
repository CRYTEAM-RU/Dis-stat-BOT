import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { setupCommands } from './commands';
import { setupDatabase } from './database';
import { syncServerSettings } from './serverSync';
import { sendServerStats } from './stats';

config(); // Load environment variables

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log('Bot is ready!');
  setupCommands(client);
  setupDatabase();
  
  // Sync server settings every hour
  setInterval(() => syncServerSettings(client), 3600000);
  
  // Send server stats every 10 minutes
  setInterval(() => sendServerStats(client), 600000);
});

client.login(process.env.DISCORD_TOKEN);

