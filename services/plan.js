const logger = require('../utils/logger');

// In production, use a proper database. For Vercel serverless, consider using:
// - Vercel KV (Redis)
// - MongoDB Atlas
// - PostgreSQL with Vercel Storage
class PlanService {
  constructor() {
    // In-memory storage for demo. Replace with persistent storage in production.
    this.usage = new Map();
    this.freeLimit = 5;
  }

  async checkQuota(userId, plan) {
    if (plan === 'paid') {
      return { allowed: true, remaining: Infinity };
    }

    const today = new Date().toDateString();
    const key = `${userId}-${today}`;
    
    const userUsage = this.usage.get(key) || { count: 0, date: today };
    
    // Reset if it's a new day
    if (userUsage.date !== today) {
      userUsage.count = 0;
      userUsage.date = today;
    }

    const remaining = Math.max(0, this.freeLimit - userUsage.count);
    
    return {
      allowed: userUsage.count < this.freeLimit,
      remaining,
      resetTime: this.getResetTime()
    };
  }

  async recordUsage(userId, plan) {
    if (plan === 'paid') return;

    const today = new Date().toDateString();
    const key = `${userId}-${today}`;
    
    const userUsage = this.usage.get(key) || { count: 0, date: today };
    userUsage.count++;
    this.usage.set(key, userUsage);

    logger.info(`Recorded usage for ${userId}: ${userUsage.count}/5 today`);
  }

  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  // Cleanup old entries (call this periodically in production)
  cleanupOldEntries() {
    const today = new Date().toDateString();
    for (const [key, value] of this.usage.entries()) {
      if (value.date !== today) {
        this.usage.delete(key);
      }
    }
  }
}

module.exports = new PlanService();
