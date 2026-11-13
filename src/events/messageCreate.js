const { Events, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const PROTECTED_CHANNEL_ID = '1570116755261759600';
const AUTO_BAN_LOG_CHANNEL_ID = '1570120342502899742';
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
      if (message.author.bot) continue;

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
      channel.id !== AUTO_BAN_LOG_CHANNEL_ID &&
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

function truncate(value, maxLength = 1024) {
  if (!value) return 'Tidak ada teks';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function buildAutoBanLogEmbed(message, banSucceeded) {
  const member = message.member;
  const accountCreatedAt = Math.floor(message.author.createdTimestamp / 1000);
  const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const attachmentLinks = [...message.attachments.values()].map((attachment) => attachment.url);
  const messageContent = [
    message.content,
    attachmentLinks.length ? `Lampiran:\n${attachmentLinks.join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(banSucceeded ? '#E74C3C' : '#F39C12')
    .setTitle(banSucceeded ? '🔨 Auto-Ban Akun' : '⚠️ Auto-Ban Gagal')
    .setDescription(
      `Akun mengirim pesan di channel laporan akun ter-hack dan telah diproses oleh sistem keamanan.\n` +
        `Status ban: **${banSucceeded ? 'Berhasil' : 'Gagal - perlu tindakan manual'}**`
    )
    .setThumbnail(message.author.displayAvatarURL({ size: 256, extension: 'png' }))
    .addFields(
      { name: '👤 Nama akun', value: truncate(`${message.author.tag}\n${message.author.username}`), inline: true },
      { name: '🆔 User ID', value: `\`${message.author.id}\``, inline: true },
      { name: '🏷️ Nama server', value: truncate(member?.displayName || 'Tidak tersedia'), inline: true },
      { name: '📅 Akun dibuat', value: `<t:${accountCreatedAt}:F>`, inline: true },
      { name: '📥 Bergabung ke server', value: joinedAt ? `<t:${joinedAt}:F>` : 'Tidak tersedia', inline: true },
      { name: '📍 Pesan berasal dari', value: `<#${message.channel.id}>`, inline: true },
      { name: '💬 Pesan yang dikirim', value: truncate(messageContent), inline: false },
      { name: '🔗 Link pesan', value: `[Buka pesan](${message.url})`, inline: false }
    )
    .setFooter({
      text: 'Athi Store • Simpan informasi ini untuk proses unban manual',
      iconURL: message.guild.iconURL() || undefined
    })
    .setTimestamp();
}

async function sendAutoBanLog(message, banSucceeded) {
  const logChannel = message.guild.channels.cache.get(AUTO_BAN_LOG_CHANNEL_ID);
  if (!logChannel?.isTextBased()) {
    throw new Error(`Channel log auto-ban ${AUTO_BAN_LOG_CHANNEL_ID} tidak ditemukan atau bukan text channel.`);
  }

  await logChannel.send({ embeds: [buildAutoBanLogEmbed(message, banSucceeded)] });
}

function buildWarningEmbed() {
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('⚠️ CHANNEL LAPOR AKUN TER-HACK')
    .setDescription(
      'Pesan dari member biasa di channel ini akan memicu prosedur keamanan otomatis. ' +
      'Akun pengirim dapat langsung di-ban dan pesan server akan dibersihkan.\n\n' +
      'Jika terkena ban, silakan hubungi Admin/Staff Athi Store untuk proses unban manual.'
    )
    .setFooter({ text: 'Athi Store • Gunakan channel ini hanya untuk laporan keamanan' })
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

      let banSucceeded = false;
      try {
        await message.guild.members.ban(message.author.id, {
          deleteMessageSeconds: 604800,
          reason: 'Mengirim pesan di channel keamanan terlarang'
        });
        banSucceeded = true;
      } catch (error) {
        console.error(`❌ Gagal auto-ban ${message.author.tag}:`, error.message);
      }

      try {
        await sendAutoBanLog(message, banSucceeded);
      } catch (error) {
        console.error(`❌ Gagal mengirim log auto-ban ${message.author.tag}:`, error.message);
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
