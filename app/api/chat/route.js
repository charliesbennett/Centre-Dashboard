import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const maxDuration = 30;

const DAILY_LIMIT = 20;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getUserId(request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(/uklc_session=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const lastPipe = token.lastIndexOf("|");
  if (lastPipe < 0) return null;
  const parts = token.slice(0, lastPipe).split("|");
  return parts.length === 2 ? parts[0] : null;
}

export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const db = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);
    const { data: newCount, error: rateError } = await db.rpc("increment_chat_usage", {
      p_user_id: userId,
      p_date: today,
    });

    if (rateError) {
      console.error("[/api/chat] rate limit error", rateError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (newCount > DAILY_LIMIT) {
      return Response.json(
        { error: `You've reached the daily limit of ${DAILY_LIMIT} messages. Your limit resets at midnight.` },
        { status: 429 }
      );
    }

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
    return Response.json({ reply, remaining: DAILY_LIMIT - newCount });
  } catch (err) {
    console.error("[/api/chat]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
