const aiService = require('../services/ai');
const planService = require('../services/plan');
const logger = require('../utils/logger');

module.exports = async (req, res) => {
  // Set CORS headers first
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
    console.log('🔍 CAPTION API CALLED - Headers:', req.headers);
    console.log('🔍 Content-Type:', req.headers['content-type']);
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      console.log('🔍 Received chunk:', chunk.length, 'bytes');
    });

    req.on('end', async () => {
      try {
        console.log('🔍 Full body length:', body.length);
        console.log('🔍 Body preview:', body.substring(0, 200));
        
        let imageBase64;
        
        if (body) {
          const parsedBody = JSON.parse(body);
          imageBase64 = parsedBody.imageData?.replace(/^data:image\/[a-z]+;base64,/, '');
        }

        if (!imageBase64) {
          console.log('❌ No image data found');
          return res.status(400).json({ error: 'No image data provided' });
        }

        console.log('✅ Image data received:', imageBase64.length, 'bytes');

        // Check user plan
        const userId = req.headers['x-user-id'] || 'anonymous';
        const userPlan = req.headers['x-user-plan'] || 'free';
        
        console.log('🔍 User:', userId, 'Plan:', userPlan);

        const planCheck = await planService.checkQuota(userId, userPlan);
        if (!planCheck.allowed) {
          console.log('❌ Quota exceeded for user:', userId);
          return res.status(429).json({
            error: 'Daily quota exceeded',
            plan: userPlan,
            remaining: 0
          });
        }

        console.log('✅ Quota check passed');

        // Generate caption
        console.log('🚀 Starting AI caption generation...');
        const caption = await aiService.getCaptionFromImage(imageBase64);
        
        // Record usage
        await planService.recordUsage(userId, userPlan);

        console.log('✅ Caption generated:', caption.substring(0, 100));

        res.status(200).json({
          caption,
          plan: userPlan,
          remaining: planCheck.remaining - 1,
          success: true
        });

      } catch (error) {
        console.error('❌ Error in request processing:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });

    req.on('error', (error) => {
      console.error('❌ Request stream error:', error);
      res.status(500).json({ error: 'Request processing error' });
    });

  } catch (error) {
    console.error('❌ Outer catch error:', error);
    res.status(500).json({
      error: 'Server setup error',
      message: error.message
    });
  }
};
