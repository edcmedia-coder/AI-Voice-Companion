import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured on server" }, { status: 500 });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    // Format transcript for Gemini
    const transcript = messages
      .map((m: { role: string; text: string }) => `${m.role === "user" ? "User" : "Companion"}: ${m.text}`)
      .join("\n");

    // We can run two parallel requests or a single structured JSON request to keep it fast and atomic!
    // Let's ask Gemini to return JSON with title, summary, and extractedMemories!
    const prompt = `Analyze the following conversational transcript between a user and their voice AI companion. Extract three items:
1. An elegant, descriptive title for this conversation (maximum 5 words, do NOT use generic names like "Voice Chat").
2. A highly polished, short summary of the conversation (1-2 sentences).
3. A list of key facts about the user's life, goals, projects, preferences, or personal details that they explicitly asked to remember or stated as important facts during the conversation. Exclude generic statements. Format each extracted memory as a simple third-person statement (e.g., "The user is building a SaaS startup").

Provide the response in raw JSON adhering strictly to this schema:
{
  "title": "string",
  "summary": "string",
  "extractedMemories": [
    {
      "content": "string",
      "category": "preference" | "interest" | "project" | "personal" | "general"
    }
  ]
}

Transcript:
${transcript}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            summary: { type: "STRING" },
            extractedMemories: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  content: { type: "STRING" },
                  category: {
                    type: "STRING",
                    enum: ["preference", "interest", "project", "personal", "general"]
                  }
                },
                required: ["content", "category"]
              }
            }
          },
          required: ["title", "summary", "extractedMemories"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini");
    }

    const result = JSON.parse(resultText);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error in summarize route:", error);
    return NextResponse.json({ error: error.message || "Failed to process session summary" }, { status: 500 });
  }
}
