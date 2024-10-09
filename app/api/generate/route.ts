import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { prompt, model } = body as {
      prompt: string
      model: 'o1-preview' | 'o1-mini'
    }

    if (!prompt || !model) {
      return NextResponse.json({ error: "Both prompt and model are required" }, { status: 400 });
    }

    // Generate text using OpenAI SDK
    const { text } = await generateText({
      model: openai(model),
      prompt: prompt,
    });

    return NextResponse.json({
      res: text,
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the response" },
      { status: 500 }
    );
  }
}
