// src/schemas/calendarPrompt.schema.ts
/**
 * JSON Schema for AI-driven calendar generation prompt input.
 * This schema validates the request payload that an AI model receives to generate calendar events.
 */
export const calendarPromptInputSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CalendarPromptInput",
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["title", "start"],
        "properties": {
          "title": { "type": "string", "description": "Event title" },
          "description": { "type": "string", "description": "Optional detailed description" },
          "start": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 start datetime"
          },
          "end": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 end datetime (optional, defaults to start+1h)"
          },
          "location": { "type": "string", "description": "Physical or virtual location" },
          "participants": {
            "type": "array",
            "items": { "type": "string", "format": "email" },
            "description": "List of participant email addresses"
          },
          "recurrence": {
            "type": "object",
            "properties": {
              "frequency": { "type": "string", "enum": ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] },
              "interval": { "type": "integer", "minimum": 1 },
              "count": { "type": "integer", "minimum": 1 },
              "until": { "type": "string", "format": "date-time" }
            },
            "description": "Recurrence rule (RRULE style)"
          },
          "reminders": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["method", "minutes"],
              "properties": {
                "method": { "type": "string", "enum": ["email", "popup", "sms"] },
                "minutes": { "type": "integer", "minimum": 0 }
              }
            }
          }
        },
        "additionalProperties": false
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "requestId": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    }
  },
  "additionalProperties": false
} as const;

/**
 * JSON Schema for AI-driven calendar generation prompt output.
 * The AI model should return an array of normalized calendar events.
 */
export const calendarPromptOutputSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CalendarPromptOutput",
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "start", "end"],
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "start": { "type": "string", "format": "date-time" },
          "end": { "type": "string", "format": "date-time" },
          "location": { "type": "string" },
          "participants": {
            "type": "array",
            "items": { "type": "string", "format": "email" }
          },
          "recurrence": { "type": "string", "description": "RRULE string" },
          "reminders": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["method", "minutes"],
              "properties": {
                "method": { "type": "string" },
                "minutes": { "type": "integer" }
              }
            }
          }
        },
        "additionalProperties": false
      }
    },
    "status": { "type": "string", "enum": ["success", "partial", "error"] },
    "errorMessage": { "type": "string" }
  },
  "additionalProperties": false
} as const;

/**
 * TypeScript interfaces derived from the schemas for compile‑time safety.
 */
export interface CalendarPromptEventInput {
  title: string;
  description?: string;
  start: string; // ISO 8601
  end?: string;
  location?: string;
  participants?: string[]; // emails
  recurrence?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    interval?: number;
    count?: number;
    until?: string;
  };
  reminders?: Array<{ method: 'email' | 'popup' | 'sms'; minutes: number }>;
}
export interface CalendarPromptInput {
  events: CalendarPromptEventInput[];
  metadata?: { requestId?: string; timestamp?: string };
}

export interface CalendarPromptEventOutput {
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  participants?: string[];
  recurrence?: string; // RRULE
  reminders?: Array<{ method: string; minutes: number }>;
}
export interface CalendarPromptOutput {
  events: CalendarPromptEventOutput[];
  status: 'success' | 'partial' | 'error';
  errorMessage?: string;
}
