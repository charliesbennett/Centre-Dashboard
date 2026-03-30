import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const { centreId, context, messages } = await req.json();

    if (!centreId) {
      return Response.json({ error: "centreId required" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a helpful assistant for UKLC centre managers.",
      "Answer questions accurately based only on the data provided below.",
      "If information is not in the data, say \"I can't find that in the current data.\"",
      "Never guess or make up student names, room numbers, or dates.",
      "Be concise. Use plain English.",
      "",
      "CENTRE DATA:",
      context || "(no context provided)",
    ].join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: (messages || []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const reply = response.content?.[0]?.text || "No response received.";
    return Response.json({ reply });
  } catch (err) {
    console.error("[/api/chat]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
