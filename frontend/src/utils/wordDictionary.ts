import TrieSearch from 'trie-search';
// @ts-ignore - no types available for this package
import words from 'an-array-of-english-words';

/**
 * Comprehensive English Dictionary Service
 * Uses Trie data structure for lightning-fast prefix searching
 * across 275,000+ English words
 */
class WordDictionaryService {
  private trie: TrieSearch<string>;
  private isInitialized: boolean = false;
  
  constructor() {
    this.trie = new TrieSearch<string>(['word'], {
      ignoreCase: true,
      min: 2, // Minimum characters to search
      idFieldOrFunction: 'word',
    });
  }
  
  /**
   * Initialize the trie with all English words
   * This is done lazily on first use to avoid blocking initial render
   */
  private initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing English dictionary with', words.length, 'words...');
    const start = performance.now();
    
    // Filter words suitable for hashtags (reasonable length, no special chars)
    const suitableWords = words.filter((word: string) => {
      return (
        word.length >= 3 && // At least 3 characters
        word.length <= 20 && // Max 20 characters (reasonable hashtag length)
        /^[a-z]+$/.test(word) && // Only lowercase letters (no punctuation)
        !word.includes("'") && // No apostrophes
        !word.includes('-') // No hyphens
      );
    });
    
    // Add all suitable words to the trie
    const wordsForTrie = suitableWords.map((word: string) => ({ word }));
    this.trie.addAll(wordsForTrie);
    
    const duration = Math.round(performance.now() - start);
    console.log(`Dictionary initialized with ${suitableWords.length} words in ${duration}ms`);
    
    this.isInitialized = true;
  }
  
  /**
   * Search for words matching the prefix
   * Returns up to 50 results, sorted by length (shorter first)
   */
  search(prefix: string): string[] {
    if (!prefix || prefix.length < 2) return [];
    
    // Initialize on first search
    this.initialize();
    
    const results = this.trie.search(prefix);
    
    // Sort by word length (shorter words first - they're usually more common)
    const sorted = results
      .map(r => r.word)
      .sort((a, b) => {
        // First priority: exact matches
        const aExact = a.toLowerCase() === prefix.toLowerCase();
        const bExact = b.toLowerCase() === prefix.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Second priority: starts with prefix
        const aStarts = a.toLowerCase().startsWith(prefix.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(prefix.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Third priority: shorter words
        return a.length - b.length;
      });
    
    return sorted.slice(0, 50); // Limit to 50 results
  }
  
  /**
   * Check if a word exists in the dictionary
   */
  has(word: string): boolean {
    this.initialize();
    const results = this.trie.search(word);
    return results.some(r => r.word.toLowerCase() === word.toLowerCase());
  }
}

// Export singleton instance
export const wordDictionary = new WordDictionaryService();

