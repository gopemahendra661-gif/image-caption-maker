const { IncomingForm } = require('formidable');
const { parse: parseDataURI } = require('data-uri-to-buffer');
const aiService = require('../services/ai');
const planService = require('../services/plan');
const logger = require('../utils/logger');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let imageBase64;
    
    // Check if it's base64 data URI
    if (req.headers['content-type']?.includes('application/json')) {
      const body = await parseJsonBody(req);
      if (body.imageData) {
        imageBase64 = body.imageData;
      } else {
        return res.status(400).json({ error: 'No image data provided' });
      }
    } else {
      // Handle multipart form data
      const form = new IncomingForm();
      const [fields, files] = await parseForm(form, req);
      
      if (!files.image) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      
      const imageFile = files.image[0];
      const buffer = imageFile.buffer || Buffer.from(await imageFile.arrayBuffer());
      imageBase64 = buffer.toString('base64');
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

    // Generate caption
    const caption = await aiService.getCaptionFromImage(imageBase64);
    
    // Record usage
    await planService.recordUsage(userId, userPlan);

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
    
    res.status(500).json({
      error: 'Failed to generate caption',
      message: error.message
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
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseForm(form, req) {
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve([fields, files]);
    });
  });
}
