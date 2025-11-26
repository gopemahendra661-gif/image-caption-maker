const axios = require('axios');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    console.log('🔍 AI Service Initialized - API Key:', this.apiKey ? 'PRESENT' : 'MISSING');
    
    if (!this.apiKey) {
      console.error('❌ OPENROUTER_API_KEY is missing!');
    }
    
    this.models = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-2-9b-it:free',
      'mistralai/mistral-7b-instruct:free'
    ];
    this.timeout = 15000;
  }

  async getCaptionFromImage(imageBase64) {
    try {
      console.log('🔍 getCaptionFromImage called, image size:', imageBase64?.length);
      
      if (!this.apiKey) {
        throw new Error('OpenRouter API key is missing');
      }

      if (!imageBase64 || imageBase64.length < 100) {
        throw new Error('Invalid image data');
      }

      const prompt = `Describe this image in one simple, natural sentence.`;
      
      for (const model of this.models) {
        try {
          console.log(`🔍 Trying model: ${model}`);
          const caption = await this.tryModel(model, prompt, imageBase64);
          
          if (caption && caption.trim().length > 10) {
            console.log(`✅ Model ${model} succeeded`);
            return caption.trim();
          }
        } catch (error) {
          console.log(`❌ Model ${model} failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All AI models failed');
      
    } catch (error) {
      console.error('❌ getCaptionFromImage error:', error);
      throw error;
    }
  }

  async tryModel(model, prompt, imageBase64) {
    console.log(`🔍 Calling OpenRouter API for model: ${model}`);
    
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { 
                  type: "image_url", 
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
                }
              ]
            }
          ],
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      console.log('✅ OpenRouter API response received');
      
      if (response.data.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
      }
      
      throw new Error('Invalid response format');
      
    } catch (error) {
      console.error(`❌ OpenRouter API error for ${model}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }
}

module.exports = new AIService();
