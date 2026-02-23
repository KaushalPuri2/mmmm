import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

import { parseFile, FileData } from '../utils/fileParser';

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  isError?: boolean;
  sources?: { title: string; uri: string }[];
  feedback?: 'positive' | 'negative';
  files?: FileData[];
}

export interface GenerationConfig {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens?: number;
  searchGrounding: boolean;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendMessageStream(
    message: string, 
    history: Message[], 
    systemInstruction?: string,
    config?: GenerationConfig
  ) {
    const tools = config?.searchGrounding ? [{ googleSearch: {} }] : [];
    
    const chat = this.ai.chats.create({
      model: config?.model || "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction || "You are a helpful assistant. Use Google Search to provide up-to-date information when relevant. Your responses should be formatted in Markdown. Be concise and direct.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        tools: tools as any,
        temperature: config?.temperature ?? 1,
        topP: config?.topP ?? 0.95,
        topK: config?.topK ?? 40,
        maxOutputTokens: config?.maxOutputTokens
      },
      history: history.slice(-15).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))
    });

    return chat.sendMessageStream({ message });
  }
}

export function getRelevantMemories(query: string, memories: string[], limit: number = 5): string[] {
  if (memories.length === 0) return [];
  
  // Common stop words to ignore
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'what', 'where', 'when', 'how', 'who', 'your', 'mine', 'about', 'some', 'they', 'them']);
  
  // Tokenize and filter query
  const queryWords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  if (queryWords.length === 0) {
    return memories.slice(-limit); // Fallback to most recent
  }

  const scoredMemories = memories.map((memory, index) => {
    const memoryLower = memory.toLowerCase();
    const memoryWords = memoryLower.replace(/[^\w\s]/g, '').split(/\s+/);
    
    let score = 0;
    let matchCount = 0;

    queryWords.forEach(word => {
      // Exact match boost
      if (memoryWords.includes(word)) {
        score += (word.length * 2); // Longer words are more specific
        matchCount++;
      } 
      // Partial match
      else if (memoryLower.includes(word)) {
        score += word.length;
        matchCount++;
      }
    });

    // Density boost: if multiple query words match, it's likely very relevant
    if (matchCount > 1) {
      score *= (1 + (matchCount * 0.2));
    }

    // Recency bias: newer memories (higher index) get a boost
    // We add a factor based on the position in the array
    const recencyFactor = (index / memories.length) * 5;
    score += recencyFactor;

    return { memory, score };
  });
  
  // Sort by score (descending)
  const sorted = scoredMemories.sort((a, b) => b.score - a.score);
  
  // Filter out zero scores and return top results
  const relevant = sorted.filter(m => m.score > 5).map(m => m.memory);
  
  if (relevant.length > 0) {
    return relevant.slice(0, limit);
  }
  
  // If no strong matches, return the most recent ones as general context
  return memories.slice(-3);
}

export const gemini = new GeminiService();
