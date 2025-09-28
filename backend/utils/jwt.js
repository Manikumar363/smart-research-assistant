const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

const storeRefreshToken = async (userId, token) => {
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const refreshToken = new RefreshToken({
      userId,
      token,
      expiresAt
    });

    await refreshToken.save();
    return refreshToken._id;
  } catch (error) {
    throw error;
  }
};

const removeRefreshToken = async (token) => {
  try {
    const result = await RefreshToken.deleteOne({ token });
    return result.deletedCount;
  } catch (error) {
    throw error;
  }
};

const isRefreshTokenValid = async (token) => {
  try {
    const refreshToken = await RefreshToken.findOne({
      token,
      expiresAt: { $gt: new Date() }
    });
    return !!refreshToken;
  } catch (error) {
    throw error;
  }
};

const cleanupExpiredTokens = async () => {
  try {
    const result = await RefreshToken.deleteMany({
      expiresAt: { $lte: new Date() }
    });
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired refresh tokens`);
    }
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error.message);
  }
};

// Clean up expired tokens every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  removeRefreshToken,
  isRefreshTokenValid,
  cleanupExpiredTokens
};