const axios = require('axios');
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
    logger.info('Received caption request', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });

    let imageBase64;
    
    // Check if it's base64 data URI from JSON
    if (req.headers['content-type']?.includes('application/json')) {
      const body = await parseJsonBody(req);
      logger.info('Parsed JSON body', { hasImageData: !!body.imageData });
      
      if (body.imageData) {
        // Clean the base64 data - remove data URL prefix if present
        imageBase64 = body.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      } else {
        return res.status(400).json({ error: 'No image data provided' });
      }
    } else {
      // For multipart form data, we need to use a different approach in serverless
      return res.status(400).json({ 
        error: 'Please use JSON format with base64 image data',
        example: {
          imageData: 'base64-string-here'
        }
      });
    }

    // Validate base64
    if (!imageBase64 || imageBase64.length < 100) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    // Check user plan and quota
    const userId = req.headers['x-user-id'] || 'anonymous';
    const userPlan = req.headers['x-user-plan'] || 'free';
    
    logger.info('Checking quota', { userId, userPlan });

    const planCheck = await planService.checkQuota(userId, userPlan);
    if (!planCheck.allowed) {
      return res.status(429).json({
        error: 'Daily quota exceeded',
        plan: userPlan,
        remaining: 0,
        resetTime: planCheck.resetTime
      });
    }

    logger.info('Quota check passed', { remaining: planCheck.remaining });

    // Generate caption
    const caption = await aiService.getCaptionFromImage(imageBase64);
    
    // Record usage
    await planService.recordUsage(userId, userPlan);

    logger.info('Caption generated successfully', { captionLength: caption.length });

    res.status(200).json({
      caption,
      plan: userPlan,
      remaining: planCheck.remaining - 1,
      success: true
    });

  } catch (error) {
    logger.error('Caption generation error:', error);
    
    if (error.message.includes('quota')) {
      return res.status(429).json({
        error: error.message,
        plan: 'free',
        remaining: 0
      });
    }
    
    if (error.message.includes('AI service is temporarily unavailable')) {
      return res.status(503).json({
        error: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate caption',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body) {
          reject(new Error('Empty request body'));
          return;
        }
        resolve(JSON.parse(body));
      } catch (e) {
        logger.error('JSON parse error:', e.message, { body: body.substring(0, 100) });
        reject(new Error('Invalid JSON: ' + e.message));
      }
    });
    req.on('error', (err) => {
      logger.error('Request stream error:', err);
      reject(err);
    });
  });
}
