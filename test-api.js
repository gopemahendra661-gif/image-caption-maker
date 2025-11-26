const aiService = require('./services/ai');

async function testAIService() {
  console.log('🧪 Testing AI Service...\n');
  
  // Test connection first
  console.log('1. Testing API connection...');
  const connection = await aiService.testConnection();
  console.log('Connection:', connection);
  
  if (!connection.success) {
    console.log('❌ API Connection failed:', connection.error);
    return;
  }
  
  console.log('✅ API Connection successful!\n');
  
  // Test with a simple base64 image (a small red dot)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  console.log('2. Testing caption generation...');
  try {
    const caption = await aiService.getCaptionFromImage(testImageBase64);
    console.log('✅ Caption generation successful!');
    console.log('Caption:', caption);
  } catch (error) {
    console.log('❌ Caption generation failed:', error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testAIService();
}

module.exports = testAIService;
