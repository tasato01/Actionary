'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export type DictionaryResult = {
  type: 'word' | 'idiom';
  term: string;
  correctedFrom?: string; // If the original query was misspelled
  meaning: string[];
  pronunciation?: string;
  etymology?: string; // Text description
  morphemes?: { part: string; meaning: string }[]; // Structured breakdown e.g. [{part: "in-", meaning: "not"}, ...]
  rootWords?: { term: string; breakdown: string; meaning: string }[]; // Words sharing the same root with meanings
  relatedWords?: string[]; // General synonyms/related
  origin?: string;        // For idioms
  examples: string[];
};

export async function searchDictionary(query: string): Promise<DictionaryResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('API Key is missing. Please set GEMINI_API_KEY in .env.local');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // List of models to try in order of preference
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-pro',
  ];

  const prompt = `
    You are an expert English-Japanese dictionary.
    Analyze the following English term or phrase: "${query}".
    
    1. **Check for spelling errors**. If the input "${query}" is likely a misspelling (and not just a rare word), assume the user meant the most likely correct English word. Set "correctedFrom" to "${query}" and "term" to the correct word.
    
    2. Determine if it is a "word" or an "idiom".
    
    3. Return ONLY a valid JSON object with the structure below.
    
    IMPORTANT: When providing Japanese translations or meanings, DO NOT include Romaji or phonetic readings (e.g., write "割増金", NOT "割増金 (warimashikin)").
    
    If it is a **word**:
    {
      "type": "word",
      "term": "Corrected Word (or original if correct)",
      "correctedFrom": "Original Misspelled Input (or null if correct)",
      "meaning": ["Japanese meaning 1", "Japanese meaning 2"],
      "pronunciation": "IPA",
      
      // Etymology Breakdown
      "etymology": "Full etymology explanation in Japanese",
      "morphemes": [
        {"part": "morpheme text (e.g. com-)", "meaning": "meaning of this part in Japanese (e.g. 共に)"}
      ],
      
      // Cognates (Words sharing the same root/stem)
      // breakdown: separate parts with '/' and wrap the MAIN shared root in '*'
      "rootWords": [
        {"term": "cognate 1", "breakdown": "pre/*dict*", "meaning": "brief meaning in Japanese"},
        {"term": "cognate 2", "breakdown": "dict/*ation*", "meaning": "brief meaning in Japanese"}
      ],
      
      "examples": ["English example / Japanese translation"]
    }

    If it is an **idiom** or phrase:
    {
      "type": "idiom",
      "term": "Corrected Idiom",
      "correctedFrom": "Original Misspelled Input (or null if correct)",
      "meaning": ["Japanese meaning 1", "Japanese meaning 2"],
      "origin": "Origin/Derivation of the expression in Japanese",
      "examples": ["English example / Japanese translation"]
    }
  `;

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      // Add a timeout to prevent hanging indefinitely
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 15000)
      );

      const resultPromise = model.generateContent(prompt);

      // Race the request against the timeout
      const result = await Promise.race([resultPromise, timeoutPromise]) as any;
      const response = await result.response;
      let text = response.text();

      // Cleanup json markdown if present
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      return JSON.parse(text) as DictionaryResult;
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message);
      lastError = error;
      // Continue to next model
    }
  }

  console.error("All models failed. Last error:", lastError);
  throw new Error("Failed to retrieve dictionary data from any available model.");
}
