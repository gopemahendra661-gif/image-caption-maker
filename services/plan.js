const logger = require('../utils/logger');

// Simple in-memory storage for demo
// In production, use Vercel KV, Redis, or a database
class PlanService {
  constructor() {
    this.usage = new Map();
    this.freeLimit = 5;
    // Cleanup every hour
    setInterval(() => this.cleanupOldEntries(), 60 * 60 * 1000);
  }

  async checkQuota(userId, plan) {
    logger.info(`Checking quota for user: ${userId}, plan: ${plan}`);
    
    if (plan === 'paid') {
      return { allowed: true, remaining: Infinity };
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${userId}-${today}`;
    
    const userUsage = this.usage.get(key) || { count: 0, date: today };
    
    // Reset if it's a new day
    if (userUsage.date !== today) {
      userUsage.count = 0;
      userUsage.date = today;
      this.usage.set(key, userUsage);
    }

    const remaining = Math.max(0, this.freeLimit - userUsage.count);
    const allowed = userUsage.count < this.freeLimit;
    
    logger.info(`Quota result: ${allowed}, used: ${userUsage.count}, remaining: ${remaining}`);
    
    return {
      allowed,
      remaining,
      resetTime: this.getResetTime()
    };
  }

  async recordUsage(userId, plan) {
    if (plan === 'paid') {
      logger.info(`Paid user ${userId} usage recorded (no quota)`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}-${today}`;
    
    const userUsage = this.usage.get(key) || { count: 0, date: today };
    userUsage.count++;
    this.usage.set(key, userUsage);

    logger.info(`Recorded usage for ${userId}: ${userUsage.count}/${this.freeLimit} today`);
  }

  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  cleanupOldEntries() {
    const today = new Date().toISOString().split('T')[0];
    let cleaned = 0;
    
    for (const [key, value] of this.usage.entries()) {
      if (value.date !== today) {
        this.usage.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old usage entries`);
    }
  }

  // For debugging
  getUsageStats() {
    return {
      totalUsers: this.usage.size,
      entries: Object.fromEntries(this.usage)
    };
  }
}

module.exports = new PlanService();
