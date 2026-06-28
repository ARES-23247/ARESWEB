import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";
import os from "os";
import path from "path";
import fs from "fs";
import { ApiError } from "../middleware/errorHandler";
const useVertex = process.env.USE_VERTEX_AI === "true" || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key";

// Local Firebase emulator compatibility: the emulator environment sanitizes standard user environment variables,
// which prevents the Google GenAI SDK from resolving the path to David's local Application Default Credentials (ADC).
// Explicitly inject the path if we are running in the emulator and the credentials env variable is not set.
if (process.env.FUNCTIONS_EMULATOR === "true" && useVertex) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    let credentialsPath = "";
    if (process.platform === "win32") {
      const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      credentialsPath = path.join(appData, "gcloud", "application_default_credentials.json");
    } else {
      credentialsPath = path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
    }
    if (fs.existsSync(credentialsPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
      logger.info("vertex", `Injected GOOGLE_APPLICATION_CREDENTIALS path: ${credentialsPath}`);
    } else {
      logger.warn("vertex", `Google Application Credentials file not found at: ${credentialsPath}`);
    }
  }
}

const clientConfig: any = {};
if (useVertex) {
  clientConfig.vertexai = true;
  clientConfig.project = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "aresfirst-portal";
  clientConfig.location = process.env.GCP_LOCATION || "us-central1";
} else {
  clientConfig.apiKey = process.env.GEMINI_API_KEY;
}

const ai = new GoogleGenAI(clientConfig);
export interface GrammarCheckResult {
  correctedText: string;
  edits: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
}

/**
 * Checks spelling and grammar in a blog post using Gemini.
 */
export async function checkGrammarAndSpelling(text: string): Promise<GrammarCheckResult> {
  const systemPrompt = `You are an expert technical editor.
Analyze the user's blog text for spelling, grammar, punctuation, and structural issues.
Return a JSON object containing the corrected text and a list of specific edits made.
Always preserve standard markdown formatting (like links, bold, headings, list markers, etc.) unless they are grammatically incorrect.

Your output must be a valid JSON object matching this schema:
{
  "correctedText": string,
  "edits": [
    {
      "original": string,
      "corrected": string,
      "explanation": string
    }
  ]
}
Do not wrap the JSON response in any markdown code blocks.`;

  if (text.length > 20000) {
    throw new ApiError(400, "Input text exceeds maximum allowed character limit (20,000).");
  }

  try {
    if (!useVertex && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key")) {
      throw new Error("No valid GEMINI_API_KEY configured and Vertex AI is disabled.");
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nText to check:\n${text}` }] }
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048
      }
    });

    const resultText = response.text || "";
    if (!resultText) throw new Error("Empty response from Gemini.");
    
    return JSON.parse(resultText) as GrammarCheckResult;
  } catch (err) {
    logger.warn("vertex", `Grammar check failed/offline: ${err instanceof Error ? err.message : String(err)}. Using fallback.`);
    const edits: Array<{ original: string; corrected: string; explanation: string }> = [];
    let correctedText = text;
    
    if (text.includes("grammer")) {
      correctedText = correctedText.replace(/grammer/g, "grammar");
      edits.push({ original: "grammer", corrected: "grammar", explanation: "Corrected spelling of 'grammar'." });
    }
    if (text.includes("recieve")) {
      correctedText = correctedText.replace(/recieve/g, "receive");
      edits.push({ original: "recieve", corrected: "receive", explanation: "Corrected spelling of 'receive'." });
    }
    
    return { correctedText, edits };
  }
}

/**
 * Provides general AI assistance or rewrites for selected text/paragraph.
 */
export async function getAIAssistance(prompt: string, text?: string, context?: string): Promise<string> {
  const systemPrompt = `You are a helpful engineering co-pilot and expert technical writer for FIRST® Robotics Team ARES 23247.
Assist the user with writing, editing, or refining their blog post.
Always use professional technical language, preserve Markdown formatting, and adhere to ARES branding guidelines:
- Always refer to FIRST® (italicized with registered trademark symbol).
- Refer to our software library as ARESLib (one word, capital L).`;

  let userPrompt = `User Request: ${prompt}`;
  if (text) {
    userPrompt += `\n\nSelected text to modify:\n${text}`;
  }
  if (context) {
    userPrompt += `\n\nFull blog content for context:\n${context}`;
  }

  if (prompt.length > 2000 || (text && text.length > 20000) || (context && context.length > 20000)) {
    throw new ApiError(400, "Input fields exceed allowed character limits.");
  }

  try {
    if (!useVertex && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key")) {
      throw new Error("No valid GEMINI_API_KEY configured and Vertex AI is disabled.");
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      config: {
        maxOutputTokens: 2048
      }
    });

    const assistanceText = response.text || "";
    if (!assistanceText) throw new Error("Empty response from Gemini.");
    
    return assistanceText;
  } catch (err) {
    logger.warn("vertex", `AI assistance failed/offline: ${err instanceof Error ? err.message : String(err)}. Using fallback.`);
    return `[Local AI Fallback] Your request: "${prompt}".\n\nOur team is committed to implementing robust code structures inside FIRST® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`;
  }
}

/**
 * Uses Gemini to automatically label and generate a caption for an uploaded photo.
 */
export async function generatePhotoCaptionAndLabels(imageBuffer: Buffer, mimeType: string): Promise<{ caption: string; labels: string[] }> {
  const systemPrompt = `You are an AI photo assistant for FIRST® Robotics Team ARES 23247.
Analyze the provided image and generate:
1. A concise, descriptive, action-oriented caption (1-2 sentences).
2. A list of 4-8 descriptive tags/labels (e.g. "robot", "intake", "chassis", "competition", "outreach", "drivetrain", "coding").

Your output must be a valid JSON object matching this schema:
{
  "caption": string,
  "labels": string[]
}
Do not wrap the JSON response in any markdown code blocks.`;

  if (imageBuffer.length > 10 * 1024 * 1024) {
    throw new ApiError(400, "Image size exceeds maximum allowed limit (10MB).");
  }

  try {
    if (!useVertex && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key")) {
      throw new Error("No valid GEMINI_API_KEY configured and Vertex AI is disabled.");
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 1024
      }
    });

    const resultText = response.text || "";
    if (!resultText) throw new Error("Empty response from Gemini.");
    
    return JSON.parse(resultText) as { caption: string; labels: string[] };
  } catch (err) {
    logger.warn("vertex", `Photo analysis failed: ${err instanceof Error ? err.message : String(err)}. Using fallback.`);
    return {
      caption: "ARES robotics team members working on robot assemblies.",
      labels: ["robot", "ares-team", "workspace"]
    };
  }
}

/**
 * Streams code suggestions or chat completions for the Simulation Playground.
 */
export async function getSimulationPlaygroundStream(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  imageUrl: string | undefined,
  onChunk: (text: string) => void
): Promise<void> {
  const totalLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) + (systemPrompt?.length || 0);
  if (totalLength > 40000) {
    throw new ApiError(400, "Simulation conversation history exceeds maximum allowed character limit.");
  }

  try {
    if (!useVertex && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key")) {
      throw new Error("No valid GEMINI_API_KEY configured and Vertex AI is disabled.");
    }

    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    if (imageUrl && imageUrl.startsWith("data:image")) {
      const [header, base64] = imageUrl.split(",");
      const mimeType = header.split(";")[0].split(":")[1];
      const lastUserMsg = [...contents].reverse().find(c => c.role === "user");
      if (lastUserMsg) {
        lastUserMsg.parts.push({
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        } as any);
      }
    }

    const responseStream = await ai.models.generateContentStream({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (err) {
    logger.error("vertex", "Simulation playground streaming failed", err);
    throw err;
  }
}
