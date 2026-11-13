const { Events, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const PROTECTED_CHANNEL_ID = '1570116755261759600';
const cleaningGuilds = new Set();

function isExempt(member, staffRoleId) {
  if (!member) return false;
  return (
    member.id === member.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    Boolean(staffRoleId && member.roles.cache.has(staffRoleId))
  );
}

async function getStaffRoleId(guild) {
  try {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    return config?.staffRoleId || process.env.STAFF_ROLE_ID || null;
  } catch (error) {
    console.error('❌ Gagal membaca konfigurasi staff untuk auto-ban:', error.message);
    return process.env.STAFF_ROLE_ID || null;
  }
}

async function deleteMessagesInChannel(channel) {
  let before;
  let deletedCount = 0;

  while (true) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!messages.size) break;

    for (const message of messages.values()) {
      try {
        await message.delete();
        deletedCount++;
      } catch (error) {
        console.warn(`⚠️ Gagal menghapus pesan ${message.id} di #${channel.name}:`, error.message);
      }
    }

    before = messages.last()?.id;
    if (!before || messages.size < 100) break;
  }

  return deletedCount;
}

async function deleteServerMessages(guild) {
  let deletedCount = 0;
  const channels = guild.channels.cache.filter(
    (channel) =>
      channel.isTextBased() &&
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread
      ].includes(channel.type)
  );

  for (const channel of channels.values()) {
    try {
      deletedCount += await deleteMessagesInChannel(channel);
    } catch (error) {
      console.warn(`⚠️ Tidak dapat membersihkan #${channel.name}:`, error.message);
    }
  }

  return deletedCount;
}

function buildWarningEmbed() {
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('🚫 PERINGATAN KEAMANAN')
    .setDescription(
      'Channel ini **dilarang mengirim pesan**.\n\n' +
      'Pesan dari user biasa akan dianggap sebagai indikasi akun bermasalah/hacked, ' +
      'user akan langsung di-ban, dan pesan server akan dibersihkan.\n\n' +
      'Jika terkena ban, silakan hubungi **Admin/Staff Athi Store** untuk proses unban manual.'
    )
    .setFooter({ text: 'Athi Store • Jangan mengirim pesan di channel ini' })
    .setTimestamp();
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot || message.channel.id !== PROTECTED_CHANNEL_ID) return;

    const staffRoleId = await getStaffRoleId(message.guild);
    if (isExempt(message.member, staffRoleId)) return;
    if (cleaningGuilds.has(message.guild.id)) return;
    cleaningGuilds.add(message.guild.id);

    try {
      try {
        await message.author.send(
          '🚫 Kamu telah di-ban dari server karena mengirim pesan di channel keamanan terlarang. ' +
          'Silakan hubungi Admin/Staff Athi Store untuk mengajukan unban manual.'
        );
      } catch (error) {
        console.warn(`⚠️ DM auto-ban gagal untuk ${message.author.tag}:`, error.message);
      }

      try {
        await message.guild.members.ban(message.author.id, {
          deleteMessageSeconds: 604800,
          reason: 'Mengirim pesan di channel keamanan terlarang'
        });
      } catch (error) {
        console.error(`❌ Gagal auto-ban ${message.author.tag}:`, error.message);
      }

      const deletedCount = await deleteServerMessages(message.guild);

      await message.channel.send({
        embeds: [
          buildWarningEmbed().setFooter({
            text: `Athi Store • ${deletedCount} pesan server dibersihkan`
          })
        ]
      });
    } catch (error) {
      console.error('❌ Gagal menjalankan prosedur auto-ban:', error.message);
    } finally {
      cleaningGuilds.delete(message.guild.id);
    }
  }
};
