require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const RULES_CATEGORY_ID = '1570115603119734834';
const RULES_CHANNEL_ID = '1570116401333539038';
const HACKED_ACCOUNT_CHANNEL_ID = '1570116755261759600';

const rules = [
  {
    name: '1. Be kind to everyone',
    value:
      'Di sini kita semua setara. No drama, no sindir-sindiran, dan no bikin suasana jadi tidak enak. Mari jaga vibe server tetap positif.'
  },
  {
    name: '2. Chat in the right channel',
    value:
      'Setiap channel dibuat untuk topik tertentu. Gunakan sesuai fungsinya agar server tetap rapi dan nyaman dilihat. No salah tempat dan no OOT berlebihan.'
  },
  {
    name: '3. No promotion without permission',
    value:
      'Silakan izin dulu ke owner/staff. Kami selalu terbuka selama sesuai aturan. Tanpa izin, promosi akan kami hapus.'
  },
  {
    name: '4. Keep it clean & safe',
    value:
      'No spam, no konten 18+, no hate speech, no ancaman, dan no kekerasan dalam bentuk apa pun. Server ini tempat yang aman untuk semua.'
  },
  {
    name: '5. Talk to us in support',
    value:
      'Ada uneg-uneg, yang mengganggu, atau saran agar server makin bagus? Sampaikan langsung di support channel, jangan dibawa ke channel umum.'
  },
  {
    name: '6. Watch your words',
    value:
      'Bebas berekspresi, tetapi tetap sopan. Hindari kata kasar, rasis, dan apa pun yang dapat menyakiti orang lain.'
  },
  {
    name: '7. Your privacy matters',
    value:
      'Jangan pernah membagikan data pribadi. No nomor telepon, alamat, atau informasi sensitif lainnya, baik milikmu maupun orang lain.'
  },
  {
    name: '8. Follow Discord rules (ToS)',
    value:
      'Selain aturan server ini, semua member juga wajib mematuhi Terms of Service dan Community Guidelines Discord.'
  },
  {
    name: '9. Sanksi untuk pelanggar aturan',
    value:
      'Pelanggaran akan ditindak bertahap:\n• Peringatan (first warning)\n• Mute 1 hari\n• Mute 3 hari\n• Permanent ban'
  }
];

async function configureRulesPermissions(guild) {
  const category = guild.channels.cache.get(RULES_CATEGORY_ID);
  const rulesChannel = guild.channels.cache.get(RULES_CHANNEL_ID);
  const hackedAccountChannel = guild.channels.cache.get(HACKED_ACCOUNT_CHANNEL_ID);

  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error(`Kategori rules ${RULES_CATEGORY_ID} tidak ditemukan atau bukan category.`);
  }
  if (!rulesChannel?.isTextBased()) {
    throw new Error(`Channel rules ${RULES_CHANNEL_ID} tidak ditemukan atau bukan text channel.`);
  }
  if (!hackedAccountChannel?.isTextBased()) {
    throw new Error(
      `Channel akun ter-hack ${HACKED_ACCOUNT_CHANNEL_ID} tidak ditemukan atau bukan text channel.`
    );
  }

  const everyone = guild.roles.everyone;
  await category.permissionOverwrites.edit(everyone, {
    ViewChannel: true,
    ReadMessageHistory: true,
    AddReactions: true,
    SendMessages: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    SendMessagesInThreads: false
  });
  await rulesChannel.permissionOverwrites.edit(everyone, {
    ViewChannel: true,
    ReadMessageHistory: true,
    AddReactions: true,
    SendMessages: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    SendMessagesInThreads: false
  });
  await hackedAccountChannel.permissionOverwrites.edit(everyone, {
    ViewChannel: true,
    ReadMessageHistory: true,
    AddReactions: true,
    SendMessages: true,
    CreatePublicThreads: true,
    CreatePrivateThreads: true,
    SendMessagesInThreads: true
  });

  console.log('✅ Permission category rules dan channel pengecualian berhasil diatur.');
}

async function setupRulesEmbed(guild, client) {
  const rulesChannel = guild.channels.cache.get(RULES_CHANNEL_ID);
  const embedColor = process.env.EMBED_COLOR || '#FF8474';
  const rulesEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle('🍑 Selamat datang di AthiStore21')
    .setDescription(
      'Tolong luangkan waktu sebentar untuk membaca aturan di bawah ini agar semua member bisa merasa aman & nyaman.\n\n' +
        '· · · · · · · · · · · · · · ·'
    )
    .addFields(rules)
    .setFooter({
      text: 'AthiStore21 • Dengan tetap berada di server, kamu dianggap menyetujui aturan ini.',
      iconURL: guild.iconURL() || undefined
    })
    .setTimestamp();

  const oldMessages = await rulesChannel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter((message) => message.author.id === client.user.id);
  for (const message of botMessages.values()) {
    await message.delete();
  }

  await rulesChannel.send({ embeds: [rulesEmbed] });
  console.log(`✅ Embed rules berhasil dikirim ke #${rulesChannel.name} (${RULES_CHANNEL_ID}).`);
}

client.on('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const guildId = process.env.GUILD_ID;
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    console.error(`❌ Guild ${guildId} tidak ditemukan!`);
    process.exit(1);
  }

  const embedColor = process.env.EMBED_COLOR || '#FF8474';

  console.log('====================================================');
  console.log('0. Mengatur Rules & Permission...');
  console.log('====================================================');
  try {
    await configureRulesPermissions(guild);
    await setupRulesEmbed(guild, client);
  } catch (err) {
    console.error('❌ Gagal mengatur rules atau permission:', err.message);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('1. Memasang Status Channels di Kategori STATUS...');
  console.log('====================================================');

  const statusCategoryId = process.env.STATUS_CATEGORY_ID || '1570115256334950440';
  const statusCategory = guild.channels.cache.get(statusCategoryId);

  if (!statusCategory) {
    console.warn(`⚠️ Kategori STATUS (${statusCategoryId}) tidak ditemukan!`);
  } else {
    const statusChannelNames = [
      '📦 | ANTRIAN: 0',
      '💰 | STOCK VIA SEND: 0',
      '💰 | STOCK RBX GIG: 0',
      '🔒 | RATE: 0',
      '🎁 | GIFT GAMEPASS: ❌',
      '⚡ | INSTANT SEND: ❌',
      '📦 | VIA LOGIN: ❌',
      '💎 | MM REKBER: ❌'
    ];
    const removedStatusLabels = ['LIMITED ITEM', 'GROUP PAYOUT'];
    const existingStatusChannels = guild.channels.cache.filter((c) => c.parentId === statusCategoryId);

    for (const channel of existingStatusChannels.values()) {
      if (removedStatusLabels.some((label) => channel.name.includes(`| ${label}:`))) {
        try {
          await channel.delete('Menghapus status channel yang tidak digunakan');
          console.log(`🗑️ Menghapus status channel "${channel.name}".`);
        } catch (err) {
          console.error(`❌ Gagal menghapus channel "${channel.name}":`, err.message);
        }
      }
    }

    for (const name of statusChannelNames) {
      const label = name.split('| ')[1].split(':')[0];
      const matches = guild.channels.cache.filter(
        (channel) => channel.parentId === statusCategoryId && channel.name.includes(`| ${label}:`)
      );
      const [primary, ...duplicates] = matches.values();

      try {
        if (primary) {
          if (primary.name !== name) await primary.setName(name);
          for (const duplicate of duplicates) {
            await duplicate.delete('Menghapus status channel duplikat');
          }
          console.log(`✅ Status channel "${name}" dinormalkan.`);
        } else {
          const newCh = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: statusCategoryId,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.Connect],
                allow: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
          console.log(`✅ Berhasil membuat status channel: ${newCh.name}`);
        }
      } catch (err) {
        console.error(`❌ Gagal memproses channel "${name}":`, err.message);
      }
    }
  }

  console.log('\n====================================================');
  console.log('2. Mengirim Embed Order ke 3 Channel Layanan...');
  console.log('====================================================');

  // Channel 1: Robux Via Send (1570117678184661203)
  const sendChannelId = process.env.CHANNEL_ROBUX_SEND || '1570117678184661203';
  const sendChannel = guild.channels.cache.get(sendChannelId);
  if (sendChannel) {
    const sendEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('⚡ ORDER ROBUX VIA SEND (USERNAME) — ATHI STORE')
      .setDescription(
        'Selamat datang di layanan pemesanan **Robux Via Send (Username)** resmi **Athi Store**!\n' +
        'Metode pengiriman Robux langsung masuk ke saldo akun Roblox kamu dengan cepat, aman, dan 100% legal.\n\n' +
        '📌 **Ketentuan & Syarat Akun:**\n' +
        '• Akun Roblox wajib sudah **berusia 18+** atau **terverifikasi identitas (KTP)**.\n' +
        '• Wajib mengaktifkan **2-Step Verification** (Authenticator / Email) untuk kelancaran transaksi.\n' +
        '• Robux langsung masuk instan tanpa waktu pending.\n' +
        '• Pembelian bebas berlaku kelipatan!\n\n' +
        '🍑 **ROBUX VIA USERNAME**\n\n' +
        '⏣ **25r**   ➜ Rp 5.000\n' +
        '⏣ **50r**   ➜ Rp 9.000\n' +
        '⏣ **100r**  ➜ Rp 15.600\n' +
        '⏣ **200r**  ➜ Rp 31.200\n' +
        '⏣ **300r**  ➜ Rp 46.800\n' +
        '⏣ **400r**  ➜ Rp 62.400\n' +
        '⏣ **500r**  ➜ Rp 78.000\n' +
        '⏣ **600r**  ➜ Rp 93.600\n' +
        '⏣ **700r**  ➜ Rp 109.200\n' +
        '⏣ **800r**  ➜ Rp 124.800\n' +
        '⏣ **900r**  ➜ Rp 140.400\n' +
        '⏣ **1000r** ➜ Rp 156.000\n' +
        '*(berlaku kelipatan)*\n\n' +
        '📌 **Dibaca yaa:**\n' +
        '• Terima robux langsung masuk tersedia untuk akun yang sudah 18+ / sudah verifikasi identitas (KTP), jadi pastikan akun kalian memenuhi syarat ya!\n' +
        '• Jangan lupa mengaktifkan verifikasi 2 langkah (Authenticator / 2SV) untuk bantu proses terima robux lebih lancar.\n\n' +
        '👇 **Klik tombol Order di bawah untuk memilih paket dan membuat pesanan!**'
      )
      .setFooter({
        text: 'Athi Store • Garansi Legal, Aman & Terpercaya',
        iconURL: guild.iconURL() || undefined
      })
      .setTimestamp();

    const sendBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('send_order_start')
        .setLabel('Order Robux Via Send')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Success)
    );

    // Hapus pesan lama bot jika ada agar channel tetap bersih
    const oldMsgs = await sendChannel.messages.fetch({ limit: 10 });
    const botMsgs = oldMsgs.filter((m) => m.author.id === client.user.id);
    for (const msg of botMsgs.values()) {
      await msg.delete().catch(() => {});
    }

    await sendChannel.send({ embeds: [sendEmbed], components: [sendBtn] });
    console.log(`✅ Embed berhasil dikirim ke: #${sendChannel.name} (${sendChannelId})`);
  } else {
    console.warn(`⚠️ Channel Robux Via Send (${sendChannelId}) tidak ditemukan!`);
  }

  // Channel 2: Robux Via Login (1570117871823098037)
  const loginChannelId = process.env.CHANNEL_ROBUX_LOGIN || '1570117871823098037';
  const loginChannel = guild.channels.cache.get(loginChannelId);
  if (loginChannel) {
    const loginEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🔐 ORDER ROBUX VIA LOGIN (VILOG) — ATHI STORE')
      .setDescription(
        'Selamat datang di layanan **Robux Via Login (Vilog)** resmi **Athi Store**!\n' +
        'Solusi terbaik bagi kamu yang ingin Robux super cepat tanpa ribet verifikasi akun.\n\n' +
        '⚡ **Keunggulan & Ketentuan Layanan:**\n' +
        '• Proses kilat **1–15 Menit** langsung masuk!\n' +
        '• **Tanpa syarat 18+ / KTP**, semua akun Roblox baru/lama bisa order.\n' +
        '• **No Limit**, bebas beli dalam jumlah banyak berapapun.\n' +
        '• Keamanan akun terjamin **100% Aman & Terpercaya**.\n' +
        '• Akun Roblox langsung di-logout oleh tim setelah proses pengisian selesai.\n\n' +
        '💎 **Daftar Harga Vilog:**\n' +
        '• **80 Robux** ➜ Rp 16.000\n' +
        '• **160 Robux** ➜ Rp 32.000\n' +
        '• **320 Robux** ➜ Rp 64.000\n' +
        '• **500 Robux** ➜ Rp 78.500\n' +
        '• **1000 Robux** ➜ Rp 157.000\n' +
        '• **1500 Robux** ➜ Rp 235.500\n\n' +
        '⚠️ *Harap jangan memberikan password di channel umum. Klik tombol tiket di bawah untuk membuat room privat dengan staf!*'
      )
      .setFooter({
        text: 'Athi Store • Proses Cepat 1-15 Menit & Bergaransi',
        iconURL: guild.iconURL() || undefined
      })
      .setTimestamp();

    const loginBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create_login')
        .setLabel('Order Robux Via Login')
        .setEmoji('🔐')
        .setStyle(ButtonStyle.Primary)
    );

    const oldMsgs = await loginChannel.messages.fetch({ limit: 10 });
    const botMsgs = oldMsgs.filter((m) => m.author.id === client.user.id);
    for (const msg of botMsgs.values()) {
      await msg.delete().catch(() => {});
    }

    await loginChannel.send({ embeds: [loginEmbed], components: [loginBtn] });
    console.log(`✅ Embed berhasil dikirim ke: #${loginChannel.name} (${loginChannelId})`);
  } else {
    console.warn(`⚠️ Channel Robux Via Login (${loginChannelId}) tidak ditemukan!`);
  }

  // Channel 3: Gift In Game (1570117951875584070)
  const giftChannelId = process.env.CHANNEL_GIFT_GAME || '1570117951875584070';
  const giftChannel = guild.channels.cache.get(giftChannelId);
  if (giftChannel) {
    const giftEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🎁 ORDER GIFT IN GAME (GIG) — ATHI STORE')
      .setDescription(
        'Selamat datang di layanan **Gift In Game (GIG) & Gamepass** resmi **Athi Store**!\n' +
        'Beli item game impian, Gamepass, Private Server, atau gift in-game favorit kamu dengan harga murah dan proses aman.\n\n' +
        '🌟 **Keunggulan Layanan:**\n' +
        '• Mendukung berbagai game Roblox populer (Blox Fruits, Pet Simulator 99, King Legacy, dll).\n' +
        '• Pengiriman cepat via Gift Gamepass, Private Server, atau Trade In-Game.\n' +
        '• Garansi aman, legal, dan bebas resiko.\n' +
        '• Tim staf siap memandu langkah demi langkah hingga item berhasil kamu terima.\n\n' +
        '💰 **Rate:** 1 Robux = Rp 95\n' +
        '💡 Total harga dihitung dari jumlah Robux × Rp 95 dan dibulatkan ke atas ke kelipatan Rp500.\n\n' +
        '📝 **Data yang perlu diisi:**\n' +
        '• Jumlah Robux\n' +
        '• Nama atau link map\n' +
        '• Jenis gamepass\n' +
        '• Username Roblox\n\n' +
        '👇 **Klik tombol di bawah ini untuk memulai pemesanan!**'
      )
      .setFooter({
        text: 'Athi Store • Layanan Gift Gamepass & Item Cepat',
        iconURL: guild.iconURL() || undefined
      })
      .setTimestamp();

    const giftBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gift_order_start')
        .setLabel('Order Gift In Game')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success)
    );

    const oldMsgs = await giftChannel.messages.fetch({ limit: 10 });
    const botMsgs = oldMsgs.filter((m) => m.author.id === client.user.id);
    for (const msg of botMsgs.values()) {
      await msg.delete().catch(() => {});
    }

    await giftChannel.send({ embeds: [giftEmbed], components: [giftBtn] });
    console.log(`✅ Embed berhasil dikirim ke: #${giftChannel.name} (${giftChannelId})`);
  } else {
    console.warn(`⚠️ Channel Gift In Game (${giftChannelId}) tidak ditemukan!`);
  }

  console.log('\n✨ Setup channels & order panels selesai dengan sukses!');
  process.exit(0);
});

client.login(process.env.TOKEN);
