const { EmbedBuilder } = require('discord.js');

async function handleAkemiCommands(interaction, db) {
  const { commandName, options, user } = interaction;

  switch (commandName) {
    case 'akemi-profile':
      await showProfile(interaction, db);
      break;
    case 'akemi-daily':
      await claimDaily(interaction, db);
      break;
    case 'akemi-leaderboard':
      await showLeaderboard(interaction, db);
      break;
    // Добавьте здесь другие команды Akemi
  }
}

async function showProfile(interaction, db) {
  const [rows] = await db.execute('SELECT * FROM user_profiles WHERE userId = ?', [interaction.user.id]);
  let profile = rows[0];

  if (!profile) {
    await db.execute('INSERT INTO user_profiles (userId) VALUES (?)', [interaction.user.id]);
    profile = { userId: interaction.user.id, xp: 0, level: 1, coins: 0 };
  }

  const profileEmbed = new EmbedBuilder()
    .setColor('#FF69B4')
    .setTitle(`Профиль ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: 'Уровень', value: profile.level.toString(), inline: true },
      { name: 'XP', value: profile.xp.toString(), inline: true },
      { name: 'Монеты', value: profile.coins.toString(), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [profileEmbed] });
}

async function claimDaily(interaction, db) {
  const [rows] = await db.execute('SELECT * FROM user_profiles WHERE userId = ?', [interaction.user.id]);
  let profile = rows[0];

  if (!profile) {
    await db.execute('INSERT INTO user_profiles (userId) VALUES (?)', [interaction.user.id]);
    profile = { userId: interaction.user.id, xp: 0, level: 1, coins: 0, lastDaily: null };
  }

  const now = new Date();
  const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : new Date(0);

  if (now - lastDaily < 24 * 60 * 60 * 1000) {
    const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    await interaction.reply(`Вы уже получили ежедневную награду. Попробуйте снова через ${hours} ч ${minutes} мин.`);
    return;
  }

  const reward = 100;
  await db.execute('UPDATE user_profiles SET coins = coins + ?, lastDaily = ? WHERE userId = ?', [reward, now, interaction.user.id]);

  await interaction.reply(`Вы получили ежедневную награду в размере ${reward} монет!`);
}

async function showLeaderboard(interaction, db) {
  const [rows] = await db.execute('SELECT * FROM user_profiles ORDER BY xp DESC LIMIT 10');

  const leaderboardEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('Таблица лидеров')
    .setDescription('Топ 10 пользователей по XP');

  for (let i = 0; i < rows.length; i++) {
    const user = await interaction.client.users.fetch(rows[i].userId);
    leaderboardEmbed.addFields({ name: `${i + 1}. ${user.username}`, value: `XP: ${rows[i].xp}, Уровень: ${rows[i].level}` });
  }

  await interaction.reply({ embeds: [leaderboardEmbed] });
}

module.exports = { handleAkemiCommands };

async function transferCoins(interaction, db) {
  const target = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  if (target.bot) {
    await interaction.reply('Нельзя передавать монеты ботам!');
    return;
  }

  if (amount <= 0) {
    await interaction.reply('Сумма должна быть положительным числом!');
    return;
  }

  const [senderRows] = await db.execute('SELECT coins FROM user_profiles WHERE userId = ?', [interaction.user.id]);
  const senderProfile = senderRows[0];

  if (!senderProfile || senderProfile.coins < amount) {
    await interaction.reply('У вас недостаточно монет для этой операции!');
    return;
  }

  await db.execute('UPDATE user_profiles SET coins = coins - ? WHERE userId = ?', [amount, interaction.user.id]);
  await db.execute('INSERT INTO user_profiles (userId, coins) VALUES (?, ?) ON DUPLICATE KEY UPDATE coins = coins + ?', [target.id, amount, amount]);

  await interaction.reply(`Вы успешно передали ${amount} монет пользователю ${target.tag}!`);
}

