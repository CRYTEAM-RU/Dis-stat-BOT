import { Client, CommandInteraction, GuildMember } from 'discord.js';

export function setupCommands(client: Client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    switch (commandName) {
      case 'kick':
        await handleKick(interaction);
        break;
      case 'ban':
        await handleBan(interaction);
        break;
      case 'mute':
        await handleMute(interaction);
        break;
      case 'nickname':
        await handleNickname(interaction);
        break;
      case 'rename-channel':
        await handleRenameChannel(interaction);
        break;
    }
  });
}

async function handleKick(interaction: CommandInteraction) {
  if (!interaction.memberPermissions?.has('KickMembers')) {
    await interaction.reply('You do not have permission to kick members.');
    return;
  }

  const member = interaction.options.getMember('user') as GuildMember;
  if (!member) {
    await interaction.reply('Please specify a valid member to kick.');
    return;
  }

  try {
    await member.kick();
    await interaction.reply(`Successfully kicked ${member.user.tag}`);
  } catch (error) {
    await interaction.reply('Failed to kick the member.');
  }
}

// Implement similar functions for ban, mute, nickname, and rename-channel

