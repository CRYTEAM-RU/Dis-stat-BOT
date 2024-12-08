import { Client } from 'discord.js';
import { getServerSettings, updateServerSettings } from './database';

export async function syncServerSettings(client: Client) {
  for (const [guildId, guild] of client.guilds.cache) {
    const settings = await getServerSettings(guildId);
    
    // Update settings based on current guild state
    const updatedSettings = {
      name: guild.name,
      memberCount: guild.memberCount,
      // Add more fields as needed
    };

    await updateServerSettings(guildId, updatedSettings);
  }
  console.log('Server settings synced');
}

