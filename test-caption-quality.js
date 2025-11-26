const aiService = require('./services/ai');

// Test image (a simple red circle - same as before)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function testCaptionQuality() {
  console.log('🧪 Testing Caption Quality...\n');
  
  try {
    const caption = await aiService.getCaptionFromImage(testImageBase64);
    console.log('✅ Generated Caption:', caption);
    console.log('\n📊 Quality Check:');
    console.log('- Length:', caption.length, 'characters');
    console.log('- Has bullet points:', /^- /.test(caption));
    console.log('- Has sections:', /:/.test(caption));
    console.log('- Sounds natural:', !/main objects|colors|setting/i.test(caption));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testCaptionQuality();
