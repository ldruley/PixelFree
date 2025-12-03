/**
 * Common photography and photo-related tags for autocomplete
 */
export const COMMON_TAGS = [
  // Nature & Landscapes
  'landscape', 'nature', 'sunset', 'sunrise', 'mountains', 'forest', 'beach', 'ocean', 'lake',
  'river', 'waterfall', 'desert', 'canyon', 'valley', 'skyline', 'cloudscape', 'nightsky',
  
  // Urban & Architecture
  'architecture', 'building', 'city', 'urban', 'street', 'streetphotography', 'downtown',
  'skyscraper', 'bridge', 'graffiti', 'industrial', 'vintage', 'rustic',
  
  // People & Portraits
  'portrait', 'selfie', 'people', 'family', 'friends', 'kids', 'children', 'baby',
  'couple', 'wedding', 'fashion', 'model', 'blackandwhite', 'bnw',
  
  // Animals & Wildlife
  'animals', 'wildlife', 'pets', 'dogs', 'cats', 'birds', 'zoo',
  
  // Food & Drink
  'food', 'foodphotography', 'cooking', 'baking', 'dessert', 'coffee', 'drinks',
  'restaurant', 'homemade', 'yummy', 'delicious',
  
  // Travel & Adventure
  'travel', 'adventure', 'explore', 'wanderlust', 'vacation', 'holiday', 'trip',
  'backpacking', 'hiking', 'camping', 'roadtrip',
  
  // Activities & Sports
  'sports', 'fitness', 'workout', 'running', 'cycling', 'swimming', 'yoga',
  'skiing', 'surfing', 'climbing',
  
  // Art & Creative
  'art', 'artistic', 'creative', 'painting', 'drawing', 'photography', 'abstract',
  'minimal', 'minimalism', 'colorful', 'monochrome',
  
  // Seasons & Weather
  'spring', 'summer', 'autumn', 'fall', 'winter', 'rain', 'snow', 'fog',
  
  // Time of Day
  'morning', 'afternoon', 'evening', 'night', 'goldenhour', 'bluehour',
  
  // Events & Occasions
  'party', 'celebration', 'birthday', 'anniversary', 'graduation', 'concert',
  'festival', 'event',
  
  // Mood & Style
  'happy', 'fun', 'peaceful', 'moody', 'dramatic', 'dreamy', 'nostalgic',
  'inspiring', 'beautiful', 'stunning', 'amazing',
  
  // Technical
  'macro', 'closeup', 'wideangle', 'panorama', 'longexposure', 'timelapse',
  'bokeh', 'depthoffield',
  
  // Social
  'instagood', 'photooftheday', 'picoftheday', 'instadaily', 'instalike',
  'instamood', 'instaart', 'photography', 'photographer', 'pixelfed'
];

/**
 * Get tag suggestions based on input
 * @param input - User's input string
 * @param existingTags - Tags already added
 * @param limit - Maximum number of suggestions
 */
export const getTagSuggestions = (
  input: string, 
  existingTags: string[] = [], 
  limit: number = 8
): string[] => {
  if (!input.trim()) return [];
  
  const searchTerm = input.toLowerCase().trim().replace(/^#/, '');
  
  return COMMON_TAGS
    .filter(tag => 
      tag.toLowerCase().includes(searchTerm) && 
      !existingTags.includes(tag)
    )
    .slice(0, limit);
};

