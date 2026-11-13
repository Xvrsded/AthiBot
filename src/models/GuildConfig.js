const mongoose = require('mongoose');

/**
 * Schema Konfigurasi Server Discord (Guild)
 * Menyimpan pengaturan channel, role staff, tiket, dan pesan welcome/goodbye per server.
 */
const guildConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ticketCategoryId: {
      type: String,
      default: null
    },
    ticketLogChannelId: {
      type: String,
      default: null
    },
    staffRoleId: {
      type: String,
      default: null
    },
    orderLogChannelId: {
      type: String,
      default: null
    },
    welcomeChannelId: {
      type: String,
      default: null
    },
    welcomeMessage: {
      type: String,
      default: 'Selamat datang {user} di **{server}**! 🎉\nSilakan cek katalog produk kami di `/pricelist` atau hubungi staff jika ada pertanyaan.'
    },
    welcomeEnabled: {
      type: Boolean,
      default: false
    },
    goodbyeChannelId: {
      type: String,
      default: null
    },
    goodbyeMessage: {
      type: String,
      default: 'Sampai jumpa {user}! Terima kasih telah mampir di **{server}** 👋'
    },
    goodbyeEnabled: {
      type: Boolean,
      default: false
    },
    embedColor: {
      type: String,
      default: process.env.EMBED_COLOR || '#FF8474'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GuildConfig', guildConfigSchema);

