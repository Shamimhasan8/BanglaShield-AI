// POST /api/v1/agent/chat — ShieldAgent conversational endpoint.
// History comes from the client (stateless server, privacy-friendly);
// every reply is labeled live-ai or rule-based-fallback — never faked.
// V8: optional `model` selects the OpenRouter chat model (validated against
// the curated catalog); the model that actually served is returned so the
// UI can label every reply honestly.
import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { isSelectableChatModel } from "@/lib/chat-models";
import { chatWithShieldAgent, type ChatMessage } from "@/lib/shield-agent";

interface ChatBody {
  messages?: { role?: string; content?: string }[];
  model?: string;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "agent-chat"), 20, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি বার্তা — কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<ChatBody>(req, 128 * 1024);
  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return fail("invalid-body", "বার্তা পাওয়া যায়নি।", 400);

  // Model selection: only ids from the curated, live-tested catalog pass.
  const model = isSelectableChatModel(body?.model) ? body?.model as string : undefined;

  // Sanitize history: roles, lengths, count.
  const messages: ChatMessage[] = raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 6000) }));

  if (messages.length === 0) return fail("invalid-body", "বার্তা পাওয়া যায়নি।", 400);

  const outcome = await chatWithShieldAgent(messages, model);
  return ok({
    reply: outcome.reply,
    engine: outcome.engine,
    note: outcome.note ?? null,
    servedModel: outcome.servedModel ?? null,
    servingProvider: outcome.servingProvider ?? null,
  });
}
