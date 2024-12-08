import { Client } from 'discord.js';
import fetch from 'node-fetch';

export async function sendServerStats(client: Client) {
  const stats = {
    totalServers: client.guilds.cache.size,
    totalMembers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
    // Add more stats as needed
  };

  try {
    const response = await fetch('https://your-website.com/api/stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stats),
    });

    if (response.ok) {
      console.log('Server stats sent successfully');
    } else {
      console.error('Failed to send server stats');
    }
  } catch (error) {
    console.error('Error sending server stats:', error);
  }
}

