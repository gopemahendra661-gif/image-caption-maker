const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      logger.error('OPENROUTER_API_KEY environment variable is not set');
    }
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.models = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-2-9b-it:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/auto'
    ];
    this.timeout = 15000; // Increased to 15 seconds
  }

  async getCaptionFromImage(imageBase64) {
    const prompt = `Describe this image in detail. Be specific about objects, people, colors, actions, setting, and mood. Provide a comprehensive caption that would be useful for accessibility purposes. Keep it under 200 words.`;

    if (!this.apiKey) {
      throw new Error('AI service configuration error');
    }

    // Validate base64
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Invalid image data provided');
    }

    for (const model of this.models) {
      try {
        logger.info(`Trying model: ${model}`);
        const caption = await this.tryModel(model, prompt, imageBase64);
        if (caption && caption.trim().length > 0) {
          logger.info(`Success with model: ${model}`, { captionLength: caption.length });
          return caption.trim();
        }
      } catch (error) {
        logger.warn(`Model ${model} failed:`, error.message);
        // Continue to next model
      }
    }

    throw new Error('AI service is temporarily unavailable. Try again.');
  }

  async tryModel(model, prompt, imageBase64) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.warn(`Model ${model} timeout after ${this.timeout}ms`);
    }, this.timeout);

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-caption-tool.vercel.app',
            'X-Title': 'AI Image Captioning Tool'
          },
          signal: controller.signal,
          timeout: this.timeout
        }
      );

      clearTimeout(timeoutId);

      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      }

      logger.warn(`No caption generated for model ${model}`, response.data);
      return null;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        throw new Error(`Model ${model} timeout`);
      }
      
      if (error.response) {
        // OpenRouter API error
        const status = error.response.status;
        const data = error.response.data;
        
        logger.error(`OpenRouter API error (${status}):`, data);
        
        if (status === 401) {
          throw new Error('Invalid API key');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded for this model');
        } else if (status === 400) {
          throw new Error('Invalid request to AI service');
        } else if (status >= 500) {
          throw new Error('AI service temporarily unavailable');
        }
      }
      
      throw error;
    }
  }
}

module.exports = new AIService();
