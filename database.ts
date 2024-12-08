import { MongoClient } from 'mongodb';

let client: MongoClient;

export async function setupDatabase() {
  client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  console.log('Connected to database');
}

export async function getServerSettings(guildId: string) {
  const db = client.db('discord_bot');
  const settings = await db.collection('server_settings').findOne({ guildId });
  return settings;
}

export async function updateServerSettings(guildId: string, settings: any) {
  const db = client.db('discord_bot');
  await db.collection('server_settings').updateOne(
    { guildId },
    { $set: settings },
    { upsert: true }
  );
}

