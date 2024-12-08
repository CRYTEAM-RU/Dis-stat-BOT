const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const { handleAkemiCommands } = require('./akemiCommands');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let db;

// Подключение к MySQL
async function connectToDatabase() {
  try {
    db = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });
    console.log('Подключено к MySQL');
    await createTablesIfNotExist();
  } catch (error) {
    console.error('Ошибка подключения к MySQL:', error);
  }
}

// Создание таблиц, если они не существуют
async function createTablesIfNotExist() {
  const createServerSettingsTable = `
    CREATE TABLE IF NOT EXISTS server_settings (
      guildId VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      memberCount INT,
      channels INT,
      roles INT
    )
  `;
  await db.execute(createServerSettingsTable);

  const createUserProfilesTable = `
    CREATE TABLE IF NOT EXISTS user_profiles (
      userId VARCHAR(255) PRIMARY KEY,
      xp INT DEFAULT 0,
      level INT DEFAULT 1,
      coins INT DEFAULT 0,
      lastDaily DATETIME
    )
  `;
  await db.execute(createUserProfilesTable);
}

// Синхронизация настроек сервера
async function syncServerSettings() {
  try {
    const servers = await client.guilds.fetch();
    for (const [guildId, guild] of servers) {
      const settings = {
        guildId: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        channels: guild.channels.cache.size,
        roles: guild.roles.cache.size,
      };
      const query = `
        INSERT INTO server_settings (guildId, name, memberCount, channels, roles)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        memberCount = VALUES(memberCount),
        channels = VALUES(channels),
        roles = VALUES(roles)
      `;
      await db.execute(query, [settings.guildId, settings.name, settings.memberCount, settings.channels, settings.roles]);
    }
    console.log('Настройки серверов синхронизированы');
  } catch (error) {
    console.error('Ошибка синхронизации настроек серверов:', error);
  }
}

// Отправка статистики сервера на сайт
async function sendServerStats() {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) as totalServers, SUM(memberCount) as totalMembers, SUM(channels) as totalChannels FROM server_settings');
    const stats = {
      totalServers: rows[0].totalServers,
      totalMembers: rows[0].totalMembers,
      totalChannels: rows[0].totalChannels,
    };

    const response = await fetch('https://your-website.com/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats),
    });

    if (response.ok) {
      console.log('Статистика сервера успешно отправлена');
    } else {
      console.error('Не удалось отправить статистику сервера');
    }
  } catch (error) {
    console.error('Ошибка отправки статистики сервера:', error);
  }
}

// Команды модерации и Akemi
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member, guild } = interaction;

  if (commandName === 'server-info' || commandName.startsWith('akemi')) {
    // Обработка команд, не требующих прав модератора
    if (commandName === 'server-info') {
      const [rows] = await db.execute('SELECT * FROM server_settings WHERE guildId = ?', [guild.id]);
      const serverInfo = rows[0];
      const serverEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Информация о сервере ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Владелец', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Участники', value: serverInfo.memberCount.toString(), inline: true },
          { name: 'Каналы', value: serverInfo.channels.toString(), inline: true },
          { name: 'Роли', value: serverInfo.roles.toString(), inline: true },
          { name: 'Дата создания', value: guild.createdAt.toDateString(), inline: true }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [serverEmbed] });
    } else {
      await handleAkemiCommands(interaction, db);
    }
  } else {
    // Проверка прав для команд модерации
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: 'У вас нет разрешения на использование этой команды.', ephemeral: true });
    }

    const targetUser = options.getUser('user');
    const targetMember = await guild.members.fetch(targetUser.id);
    const reason = options.getString('reason') || 'Причина не указана';

    switch (commandName) {
      case 'kick':
        if (targetMember.kickable) {
          await targetMember.kick(reason);
          await interaction.reply(`Пользователь ${targetUser.tag} был кикнут. Причина: ${reason}`);
        } else {
          await interaction.reply({ content: 'Я не могу кикнуть этого пользователя.', ephemeral: true });
        }
        break;

      case 'ban':
        if (targetMember.bannable) {
          await targetMember.ban({ reason });
          await interaction.reply(`Пользователь ${targetUser.tag} был забанен. Причина: ${reason}`);
        } else {
          await interaction.reply({ content: 'Я не могу забанить этого пользователя.', ephemeral: true });
        }
        break;

      case 'mute':
        const duration = options.getInteger('duration');
        if (targetMember.moderatable) {
          await targetMember.timeout(duration * 60 * 1000, reason);
          await interaction.reply(`Пользователь ${targetUser.tag} был замучен на ${duration} минут. Причина: ${reason}`);
        } else {
          await interaction.reply({ content: 'Я не могу замутить этого пользователя.', ephemeral: true });
        }
        break;

      case 'nickname':
        const newNickname = options.getString('nickname');
        if (targetMember.manageable) {
          await targetMember.setNickname(newNickname, reason);
          await interaction.reply(`Никнейм пользователя ${targetUser.tag} изменен на ${newNickname}`);
        } else {
          await interaction.reply({ content: 'Я не могу изменить никнейм этого пользователя.', ephemeral: true });
        }
        break;

      case 'rename-channel':
        const channel = options.getChannel('channel');
        const newName = options.getString('name');
        if (channel.manageable) {
          await channel.setName(newName, reason);
          await interaction.reply(`Канал переименован в ${newName}`);
        } else {
          await interaction.reply({ content: 'Я не могу переименовать этот канал.', ephemeral: true });
        }
        break;
    }
  }
});

client.once('ready', async () => {
  console.log(`Бот вошел в систему как ${client.user.tag}`);
  await connectToDatabase();
  
  // Синхронизация настроек сервера каждый час
  setInterval(syncServerSettings, 3600000);
  
  // Отправка статистики сервера каждые 10 минут
  setInterval(sendServerStats, 600000);
});

client.login(process.env.DISCORD_TOKEN);

// Логирование ошибок
client.on('error', console.error);
process.on('unhandledRejection', console.error);

console.log('Бот запускается...');

