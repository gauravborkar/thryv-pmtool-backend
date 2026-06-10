import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import prisma from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

// Force reload .env just in case the server wasn't restarted after keys were added
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// We'll instantiate models inside the generation functions so they pick up dynamically loaded keys
let genAI: GoogleGenerativeAI;
let groq: Groq;

export type AIModelType = 'groq' | 'gemini';

/**
 * Generate calendar entries using Google Gemini.
 */
async function generateWithGemini(prompt: string): Promise<string> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  
  const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Generate calendar entries using Groq.
 */
async function generateWithGroq(prompt: string): Promise<string> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }

  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are Sentari, an expert AI social media manager. Respond only with valid JSON as requested.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' },
  });

  return chatCompletion.choices[0]?.message?.content || '';
}

/**
 * Build a context string from the dynamic ClientKnowledge tables.
 */
export async function buildContext(client_id: number): Promise<string> {
  const knowledgeSheets = await prisma.clientKnowledge.findMany({
    where: { client_id }
  });

  if (knowledgeSheets.length === 0) {
    return "No prior context available for this client.";
  }

  let context = "Context Information from the client's uploaded spreadsheets:\n\n";
  const GLOBAL_MAX_CHARS = 10000; // ~2500 tokens total maximum

  for (const sheet of knowledgeSheets) {
    if (context.length > GLOBAL_MAX_CHARS) {
      context += "\n\n... [ADDITIONAL SHEETS TRUNCATED DUE TO STRICT AI TOKEN LIMITS]\n";
      break;
    }

    context += `--- Sheet: ${sheet.sheet_name} ---\n`;
    
    // 1. If it's a large array, only take the first 10 rows
    let sheetData = sheet.data as any;
    if (Array.isArray(sheetData) && sheetData.length > 10) {
      sheetData = sheetData.slice(0, 10);
    }
    
    // 2. Stringify without formatting
    let sheetStr = JSON.stringify(sheetData);
    
    // 3. Absolute hard cutoff per sheet
    if (sheetStr.length > 2500) {
      sheetStr = sheetStr.substring(0, 2500) + '... [TRUNCATED]';
    }
    
    context += sheetStr;
    context += "\n\n";
  }

  return context;
}

/**
 * Main entry point to generate calendar data, allowing dynamic model switching or fallback.
 */
export async function generateCalendarData(prompt: string, requestedModel: AIModelType | 'auto' = 'auto'): Promise<string> {
  // If a specific model is requested, try it first
  if (requestedModel === 'groq') {
    try {
      return await generateWithGroq(prompt);
    } catch (error) {
      console.warn('Groq generation failed, falling back to Gemini...', error);
      return await generateWithGemini(prompt);
    }
  }

  if (requestedModel === 'gemini') {
    try {
      return await generateWithGemini(prompt);
    } catch (error) {
      console.warn('Gemini generation failed, falling back to Groq...', error);
      return await generateWithGroq(prompt);
    }
  }

  // Auto mode: Default to Gemini as primary, fallback to Groq on 429 or failure
  try {
    return await generateWithGemini(prompt);
  } catch (error: any) {
    console.warn(`Auto mode (Gemini) failed: ${error.message}. Falling back to Groq Llama 3.3...`);
    return await generateWithGroq(prompt);
  }
}
