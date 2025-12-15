'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export type MeaningGroup = {
  partOfSpeech: string; // e.g., "noun", "verb", "adjective", "idiom"
  definitions: string[];
};

export type Morpheme = {
  part: string;
  meaning: string;
};

export type RootWord = {
  term: string;
  breakdown: string;
  meaning: string;
};

export type DictionaryResult = {
  type: 'word' | 'idiom';
  term: string;
  correctedFrom?: string; // If the original query was misspelled
  meaning: MeaningGroup[];
  pronunciation?: string;
  etymology?: string; // Text description
  morphemes?: Morpheme[]; // Structured breakdown e.g. [{part: "in-", meaning: "not"}, ...]
  rootWords?: RootWord[]; // Words sharing the same root with meanings
  relatedWords?: string[]; // General synonyms/related
  origin?: string;        // For idioms
  examples: string[];
};

export async function searchDictionary(query: string): Promise<DictionaryResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('API Key is missing.');
    // Return null instead of throwing to prevent 500 error on client
    // client can check for null result with specific error state
    throw new Error('Server configuration error: API Key missing');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // List of models to try in order of preference
  const candidateModels = [
    'gemini-2.0-flash-exp', // Try the experimental 2.0 flash model first for speed/quality
    'gemini-1.5-flash',
    'gemini-pro',
  ];

  const prompt = `
    You are an expert English-Japanese dictionary.
    Analyze the following English term or phrase: "${query}".
    
    1. **Check for spelling errors**. If the input "${query}" is likely a misspelling (and not just a rare word), assume the user meant the most likely correct English word. Set "correctedFrom" to "${query}" and "term" to the correct word.
    
    2. Determine if it is a "word" or an "idiom".
    
    3. Return ONLY a valid JSON object with the structure below. Do not include markdown formatting like \`\`\`json.
    
    IMPORTANT: When providing Japanese translations or meanings, DO NOT include Romaji or phonetic readings.
    
    If it is a **word**:
    {
      "type": "word",
      "term": "Corrected Word (or original if correct)",
      "correctedFrom": "Original Misspelled Input (or null if correct)",
      "meaning": [
        {
          "partOfSpeech": "noun", 
          "definitions": ["Japanese meaning 1", "Japanese meaning 2"]
        },
        {
          "partOfSpeech": "verb", 
          "definitions": ["Japanese meaning 1"]
        }
      ],
      "pronunciation": "IPA",
      
      // Etymology Breakdown
      "etymology": "Full etymology explanation in Japanese",
      "morphemes": [
        {"part": "morpheme text (e.g. com-)", "meaning": "meaning of this part in Japanese"}
      ],
      
      // Cognates (Words sharing the same root/stem)
      "rootWords": [
        {"term": "cognate 1", "breakdown": "pre/*dict*", "meaning": "brief meaning in Japanese"}
      ],
      "examples": ["English example / Japanese translation"]
    }

    If it is an **idiom** or phrase:
    {
      "type": "idiom",
      "term": "Corrected Idiom",
      "correctedFrom": "Original Misspelled Input (or null if correct)",
      "meaning": [
        {
          "partOfSpeech": "phrase",
          "definitions": ["Japanese meaning 1"]
        }
      ],
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

      // Cleanup json markdown if present (double check)
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      // Attempt parsing
      const data = JSON.parse(text) as DictionaryResult;

      // Basic validation of structure
      if (!data.term || !Array.isArray(data.meaning)) {
        throw new Error("Invalid response structure from model");
      }

      return data;
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message);
      lastError = error;
      // Continue to next model
    }
  }

  console.error("All models failed. Last error:", lastError);
  // Rethrowing specifically so the client can catch it. 
  // In Next.js Server Actions, throwing an Error is the standard way to signal failure.
  throw new Error("Failed to retrieve dictionary data. Please try again.");
}
