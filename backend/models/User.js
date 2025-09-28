const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: function() {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.email}`;
    }
  },
  plan: {
    type: String,
    enum: ['free', 'premium', 'enterprise'],
    default: 'free'
  },
  credits: {
    type: Number,
    default: 100,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // User Statistics
  statistics: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    totalReports: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      default: 0
    },
    creditsUsed: {
      type: Number,
      default: 0
    },
    lastActivityDate: {
      type: Date,
      default: Date.now
    }
  },
  // User Preferences
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    reportFormat: {
      type: String,
      enum: ['pdf', 'word', 'markdown'],
      default: 'pdf'
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.statistics.lastActivityDate = new Date();
  return this.save();
};

// Instance method to increment question count
userSchema.methods.incrementQuestions = function() {
  this.statistics.totalQuestions += 1;
  this.statistics.lastActivityDate = new Date();
  return this.save();
};

// Instance method to increment report count
userSchema.methods.incrementReports = function() {
  this.statistics.totalReports += 1;
  this.statistics.lastActivityDate = new Date();
  return this.save();
};

// Instance method to increment session count
userSchema.methods.incrementSessions = function() {
  this.statistics.totalSessions += 1;
  this.statistics.lastActivityDate = new Date();
  return this.save();
};

// Instance method to update credits used
userSchema.methods.updateCreditsUsed = function(creditsSpent) {
  this.statistics.creditsUsed += creditsSpent;
  this.credits = Math.max(0, this.credits - creditsSpent);
  this.statistics.lastActivityDate = new Date();
  return this.save();
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

// Static method to find by username
userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username, isActive: true });
};

// Static method for password validation (backward compatibility)
userSchema.statics.validatePassword = function(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;