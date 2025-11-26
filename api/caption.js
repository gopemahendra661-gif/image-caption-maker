const aiService = require('../services/ai');
const planService = require('../services/plan');
const logger = require('../utils/logger');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-User-Plan');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logger.info('📨 Received caption request', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      userAgent: req.headers['user-agent']
    });

    let imageBase64;
    
    if (req.headers['content-type']?.includes('application/json')) {
      const body = await parseJsonBody(req);
      
      if (!body.imageData) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Clean the base64 data
      imageBase64 = body.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      if (imageBase64.length < 100) {
        return res.status(400).json({ error: 'Invalid image data - too short' });
      }
      
      logger.info(`✅ Image data received: ${Math.round(imageBase64.length / 1024)}KB`);
    } else {
      return res.status(400).json({ 
        error: 'Please use JSON format with base64 image data',
        example: { imageData: 'base64-string-here' }
      });
    }

    // Check user plan and quota
    const userId = req.headers['x-user-id'] || 'anonymous';
    const userPlan = req.headers['x-user-plan'] || 'free';
    
    const planCheck = await planService.checkQuota(userId, userPlan);
    if (!planCheck.allowed) {
      return res.status(429).json({
        error: 'Daily quota exceeded',
        plan: userPlan,
        remaining: 0,
        resetTime: planCheck.resetTime
      });
    }

    logger.info(`✅ Quota check passed for ${userId}, remaining: ${planCheck.remaining}`);

    // Test AI service connection first
    logger.info('🔧 Testing AI service connection...');
    const connectionTest = await aiService.testConnection();
    if (!connectionTest.success) {
      logger.error('❌ AI service connection failed:', connectionTest.error);
      return res.status(503).json({
        error: 'AI service configuration error',
        message: 'Please check API key configuration'
      });
    }
    
    logger.info('✅ AI service connection successful');

    // Generate caption
    logger.info('🚀 Starting caption generation...');
    const caption = await aiService.getCaptionFromImage(imageBase64);
    
    // Record usage
    await planService.recordUsage(userId, userPlan);

    logger.info('✅ Caption generated successfully', { 
      captionLength: caption.length,
      preview: caption.substring(0, 100) + '...'
    });

    res.status(200).json({
      caption,
      plan: userPlan,
      remaining: planCheck.remaining - 1,
      success: true
    });

  } catch (error) {
    logger.error('❌ Caption generation failed:', {
      error: error.message,
      stack: error.stack
    });
    
    if (error.message.includes('quota')) {
      return res.status(429).json({
        error: error.message,
        plan: 'free',
        remaining: 0
      });
    }
    
    if (error.message.includes('AI service is temporarily unavailable')) {
      return res.status(503).json({
        error: error.message,
        suggestion: 'Please try again in a few moments or check your API key'
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate caption',
      message: error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  }
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}
