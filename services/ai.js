const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.models = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-2-9b-it:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/auto'
    ];
    this.timeout = 10000;
  }

  async getCaptionFromImage(imageBase64) {
    const prompt = `Describe this image in detail. Be specific about objects, people, colors, actions, setting, and mood. Provide a comprehensive caption that would be useful for accessibility purposes.`;

    for (const model of this.models) {
      try {
        logger.info(`Trying model: ${model}`);
        const caption = await this.tryModel(model, prompt, imageBase64);
        if (caption) {
          logger.info(`Success with model: ${model}`);
          return caption;
        }
      } catch (error) {
        logger.warn(`Model ${model} failed:`, error.message);
        continue;
      }
    }

    throw new Error('AI service is temporarily unavailable. Try again.');
  }

  async tryModel(model, prompt, imageBase64) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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
          max_tokens: 300
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

      if (response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content.trim();
      }

      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.code === 'ABORT_ERR') {
        throw new Error(`Model ${model} timeout`);
      }
      
      if (error.response?.status === 429) {
        logger.warn(`Rate limit for model ${model}`);
        throw new Error('Rate limit exceeded');
      }
      
      throw error;
    }
  }
}

module.exports = new AIService();
