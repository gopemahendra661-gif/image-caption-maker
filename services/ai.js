async getCaptionFromImage(imageBase64) {
  const prompt = `You are an expert at creating natural, human-like image captions. 
  
  Look at this image and create a SINGLE, FLOWING paragraph that describes it naturally. 
  
  DO NOT use bullet points, numbered lists, or separate sections.
  DO NOT start with "This image shows..." or "In this image..."
  DO NOT mention that you're describing an image.
  
  Just describe what you see in a natural, conversational way as if you're telling a friend about the image.
  
  Guidelines:
  - Write 1-2 sentences maximum
  - Keep it simple and direct
  - Focus on the main subject and purpose
  - Use natural language
  - No technical formatting
  
  Example good caption: "A beautiful sunset over mountains with vibrant orange and purple skies reflecting on a calm lake."
  Example bad caption: "- Colors: orange and purple - Main objects: mountains and lake - Setting: sunset"`;

  for (const model of this.models) {
    try {
      logger.info(`Trying model: ${model}`);
      const caption = await this.tryModel(model, prompt, imageBase64);
      
      if (caption && this.isGoodCaption(caption)) {
        logger.info(`✅ Success with model: ${model}`);
        return this.cleanCaption(caption);
      } else {
        logger.warn(`Model ${model} returned poor quality caption: ${caption}`);
      }
    } catch (error) {
      logger.warn(`Model ${model} failed:`, error.message);
      continue;
    }
  }

  throw new Error('AI service is temporarily unavailable. Try again.');
}

// Check if caption is natural and not technical
isGoodCaption(caption) {
  const badPatterns = [
    /^- /, // Bullet points
    /^•/, // Bullet points
    /\d\./, // Numbered lists
    /main objects:/i,
    /colors:/i, 
    /setting:/i,
    /this image shows/i,
    /in this image/i,
    /the image depicts/i
  ];
  
  const hasBadPattern = badPatterns.some(pattern => pattern.test(caption));
  const isTooShort = caption.trim().length < 20;
  const isTooLong = caption.trim().length > 500;
  
  return !hasBadPattern && !isTooShort && !isTooLong;
}

// Clean up the caption
cleanCaption(caption) {
  // Remove common AI prefixes
  const cleaned = caption
    .replace(/^(caption|description|image|picture):?\s*/i, '')
    .replace(/["']/g, '')
    .trim();
  
  // Ensure it starts with capital letter and ends with period
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).replace(/\.$/, '') + '.';
}
