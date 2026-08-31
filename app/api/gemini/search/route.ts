import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "No query provided" }, { status: 400 });
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

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((chunk: any) => ({
      title: chunk.web?.title || "Web Reference",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri !== "");

    return NextResponse.json({
      answer: text,
      sources
    });

  } catch (error: any) {
    console.error("Error in search grounding route:", error);
    return NextResponse.json({ error: error.message || "Failed to query search grounding" }, { status: 500 });
  }
}
