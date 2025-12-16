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

export type SearchResponse =
  | { success: true; data: DictionaryResult }
  | { success: false; error: string };

export async function searchDictionary(query: string): Promise<SearchResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('API Key is missing.');
    return { success: false, error: 'Server configuration error: GEMINI_API_KEY is missing.' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // List of models to try in order of preference
  const candidateModels = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
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
      
      
      // Etymology Breakdown (MANDATORY)
      "etymology": "Full etymology explanation in Japanese",
      "morphemes": [
        {"part": "com-", "meaning": "ともに、完全に (together, completely)"},
        {"part": "prehend", "meaning": "つかむ、捕らえる (seize, grasp)"}
      ],
      
      // Cognates / Root Words (MANDATORY - Provide at least 3 if possible)
      // Words that share the same etymological root.
      // IMPORTANT: In "breakdown", surround the shared root part with asterisks (*) to highlight it.
      "rootWords": [
        {"term": "prediction", "breakdown": "pre/*dict*/*ion*", "meaning": "prediction"},
        {"term": "contradict", "breakdown": "contra/*dict*", "meaning": "deny the truth"}
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

  let checkError: any = null;

  for (const modelName of candidateModels) {
    // Retry logic for 503 Service Unavailable
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        // Add a timeout to prevent hanging indefinitely (Keep it within maxDuration)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 25000)
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

        return { success: true, data };
      } catch (error: any) {
        console.warn(`Model ${modelName} attempt ${attempt + 1} failed:`, error.message);

        // Capture the first error as it's likely the most relevant
        if (!checkError && error.message.includes('503')) {
          checkError = error; // Prioritize 503 for feedback if everything fails
        } else if (!checkError) {
          checkError = error;
        }

        // Only retry if it's a 503 error or request timeout
        const isTransient = error.message.includes('503') || error.message.includes('timed out');
        if (!isTransient) break; // Don't retry other errors, move to next model or fail

        // Wait a small delay before retry
        if (attempt === 0) await new Promise(res => setTimeout(res, 1000));
      }
    }
  }

  console.error("All models failed. Primary error:", checkError);
  return {
    success: false,
    error: `Failed to retrieve dictionary data. Last error: ${checkError?.message || 'Unknown error'}`
  };
}
