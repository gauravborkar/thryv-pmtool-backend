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
async function generateWithGemini(prompt: string, customApiKey?: string | null): Promise<{ text: string, tokensUsed: number }> {
  let activeGenAI: GoogleGenerativeAI;
  
  if (customApiKey) {
    activeGenAI = new GoogleGenerativeAI(customApiKey);
  } else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }
    if (!genAI) {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    activeGenAI = genAI;
  }
  
  const geminiModel = activeGenAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  return { 
    text: response.text(),
    tokensUsed: response.usageMetadata?.totalTokenCount || 0
  };
}

/**
 * Generate calendar entries using Groq.
 */
async function generateWithGroq(prompt: string, customApiKey?: string | null): Promise<{ text: string, tokensUsed: number }> {
  let activeGroq: Groq;

  if (customApiKey) {
    activeGroq = new Groq({ apiKey: customApiKey });
  } else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured in .env');
    }
    if (!groq) {
      groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    activeGroq = groq;
  }

  const chatCompletion = await activeGroq.chat.completions.create({
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

  return {
    text: chatCompletion.choices[0]?.message?.content || '',
    tokensUsed: chatCompletion.usage?.total_tokens || 0
  };
}

/**
 * Build a context string from the dynamic ClientKnowledge tables.
 */
export async function buildContext(client_id: number): Promise<string> {
  let context = "";

  // 1. Fetch Core Client Brand Context
  const client = await prisma.client.findUnique({
    where: { id: client_id },
    select: { brand_details: true }
  });

  if (client?.brand_details) {
    const brand = client.brand_details as any;
    if (brand.aiProfileContext) {
      context += `--- Client AI Profile Context ---\n${brand.aiProfileContext}\n\n`;
    }
    if (brand.briefGuidelines) {
      context += `--- Creative Brief / Guidelines ---\n${brand.briefGuidelines}\n\n`;
    }
    if (brand.contentPillars) {
      context += `--- Content Pillars ---\n${brand.contentPillars}\n\n`;
    }
    if (brand.instagramPortal) {
      context += `--- Client Instagram Portal ---\n${brand.instagramPortal}\n\n`;
    }
    if (brand.referenceLinks) {
      context += `--- Reference / Inspirational Links ---\n${brand.referenceLinks}\n\n`;
    }
  }

  // 2. Fetch Spreadsheet Knowledge
  const knowledgeSheets = await prisma.clientKnowledge.findMany({
    where: { client_id }
  });

  if (!knowledgeSheets || knowledgeSheets.length === 0) {
    return "No prior context available for this client.";
  }

  if (knowledgeSheets.length > 0) {
    context += "--- Spreadsheet Context Information ---\n\n";
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
  }

  return context;
}

/**
 * Main entry point to generate calendar data, allowing dynamic model switching or fallback.
 */
export async function generateCalendarData(prompt: string, requestedModel: AIModelType | 'auto' = 'auto', userId?: number): Promise<string> {
  let customApiKey = null;

  let generatedResult: { text: string, tokensUsed: number } | null = null;

  // If a specific model is requested, try it first
  if (requestedModel === 'groq') {
    try {
      generatedResult = await generateWithGroq(prompt, customApiKey);
    } catch (error) {
      console.warn('Groq generation failed, falling back to Gemini...', error);
      generatedResult = await generateWithGemini(prompt, customApiKey);
    }
  } else if (requestedModel === 'gemini') {
    try {
      generatedResult = await generateWithGemini(prompt, customApiKey);
    } catch (error) {
      console.warn('Gemini generation failed, falling back to Groq...', error);
      generatedResult = await generateWithGroq(prompt, customApiKey);
    }
  } else {
    // Auto mode: Default to Gemini as primary, fallback to Groq on 429 or failure
    try {
      generatedResult = await generateWithGemini(prompt, customApiKey);
    } catch (geminiError: any) {
      console.warn(`Auto mode (Gemini) failed: ${geminiError.message}. Falling back to Groq Llama 3.3...`);
      try {
        generatedResult = await generateWithGroq(prompt, customApiKey);
      } catch (groqError: any) {
        if (customApiKey) {
          throw new Error(`Your custom API Key failed for both Gemini (${geminiError.message}) and Groq (${groqError.message}). Please ensure you saved a valid API key.`);
        }
        throw groqError;
      }
    }
  }


  return generatedResult?.text || '';
}

