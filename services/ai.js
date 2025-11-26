const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    // Updated free models that actually work
    this.models = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-2-9b-it:free', 
      'mistralai/mistral-7b-instruct:free',
      'huggingfaceh4/zephyr-7b-beta:free',
      'openrouter/auto'
    ];
    this.timeout = 20000; // 20 seconds
  }

  async getCaptionFromImage(imageBase64) {
    // Better prompt for image description
    const prompt = `You are an expert at describing images. Look at this image carefully and provide a detailed, accurate description. Include:
    - Main objects and people
    - Colors and visual elements  
    - Setting and background
    - Actions or activities
    - Mood and atmosphere
    - Any text visible in the image
    
    Be descriptive but concise. Focus on being helpful for accessibility.`;

    if (!this.apiKey) {
      logger.error('OPENROUTER_API_KEY is missing');
      throw new Error('AI service configuration error - API key missing');
    }

    // Validate image data
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error('Invalid image data provided');
    }

    let lastError = null;

    for (const model of this.models) {
      try {
        logger.info(`Attempting model: ${model}`);
        const caption = await this.tryModel(model, prompt, imageBase64);
        
        if (caption && caption.trim().length > 10) { // Minimum length check
          logger.info(`✅ Success with model: ${model}`);
          return this.cleanCaption(caption);
        } else {
          logger.warn(`Model ${model} returned empty caption`);
        }
      } catch (error) {
        lastError = error;
        logger.warn(`❌ Model ${model} failed:`, error.message);
        // Continue to next model
      }
    }

    logger.error('All models failed. Last error:', lastError);
    throw new Error('AI service is temporarily unavailable. Try again in a few moments.');
  }

  async tryModel(model, prompt, imageBase64) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Model ${model} timeout after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const response = await axios.post(
          `${this.baseURL}/chat/completions`,
          {
            model: model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: prompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${imageBase64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 500,
            temperature: 0.3, // More deterministic
            top_p: 0.9
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://ai-caption-tool.vercel.app',
              'X-Title': 'AI Image Captioning Tool'
            },
            timeout: this.timeout
          }
        );

        clearTimeout(timeoutId);

        if (response.data.choices && 
            response.data.choices[0] && 
            response.data.choices[0].message && 
            response.data.choices[0].message.content) {
          resolve(response.data.choices[0].message.content);
        } else {
          reject(new Error('Invalid response format from AI model'));
        }

      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.response) {
          const status = error.response.status;
          const errorData = error.response.data;
          
          logger.error(`OpenRouter API Error (${status}):`, errorData);
          
          if (status === 401) {
            reject(new Error('Invalid API key - check OPENROUTER_API_KEY'));
          } else if (status === 429) {
            reject(new Error('Rate limit exceeded - try again later'));
          } else if (status === 400) {
            reject(new Error('Bad request - invalid image or parameters'));
          } else if (status === 404) {
            reject(new Error('Model not found or unavailable'));
          } else {
            reject(new Error(`API error: ${status} - ${JSON.stringify(errorData)}`));
          }
        } else if (error.request) {
          reject(new Error('No response from AI service - network issue'));
        } else {
          reject(error);
        }
      }
    });
  }

  cleanCaption(caption) {
    // Remove any unwanted prefixes or formatting
    return caption
      .replace(/^(Caption|Description|Image):\s*/i, '')
      .replace(/["']/g, '')
      .trim();
  }

  // Test method to check API connectivity
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000
      });
      
      logger.info('OpenRouter connection test successful');
      return { success: true, models: response.data.data.length };
    } catch (error) {
      logger.error('OpenRouter connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIService();
