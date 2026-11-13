const mongoose = require('mongoose');

/**
 * Schema Data Pengguna (User) Athi Store
 * Mencatat riwayat pembelian dan informasi akun Roblox pengguna.
 */
const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userTag: {
      type: String,
      default: ''
    },
    robloxUsername: {
      type: String,
      default: null
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);

