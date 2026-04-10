import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCrewBotTools } from "@/lib/ai/tools";
import { buildContextSystemMessage, type PageContext } from "@/lib/crewbot/context";
import { getUserRole, hasPermission } from "@/lib/permissions";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 60;

// ── Rate limits ───────────────────────────────────────────────────────────────
const DAILY_LIMITS = {
  trial:    50,
  active:   200,
  default:  50,
};

async function checkRateLimit(
  businessId: string,
  subscriptionStatus: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const limit = DAILY_LIMITS[subscriptionStatus as keyof typeof DAILY_LIMITS] ?? DAILY_LIMITS.default;

  // Upsert usage row (no-op if exists)
  await admin
    .from("ai_usage")
    .upsert({ business_id: businessId, date: today, message_count: 0 }, {
      onConflict: "business_id,date",
      ignoreDuplicates: true,
    });

  // Fetch current count
  const { data: current } = await admin
    .from("ai_usage")
    .select("message_count")
    .eq("business_id", businessId)
    .eq("date", today)
    .single();

  const count = (current as { message_count: number } | null)?.message_count ?? 0;
  return { allowed: count < limit, remaining: Math.max(0, limit - count), limit };
}

async function incrementUsage(businessId: string): Promise<void> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Ensure row exists
  await admin.from("ai_usage").upsert(
    { business_id: businessId, date: today, message_count: 0 },
    { onConflict: "business_id,date", ignoreDuplicates: true }
  );

  // Read then increment
  const { data: row } = await admin
    .from("ai_usage")
    .select("message_count")
    .eq("business_id", businessId)
    .eq("date", today)
    .single();

  const current = (row as { message_count: number } | null)?.message_count ?? 0;
  await admin
    .from("ai_usage")
    .update({ message_count: current + 1 } as never)
    .eq("business_id", businessId)
    .eq("date", today);
}

async function saveMessages(
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("ai_messages").insert([
    { conversation_id: conversationId, role: "user",      content: userMessage },
    { conversation_id: conversationId, role: "assistant", content: assistantMessage },
  ] as never);
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(businessName: string, trade: string, businessId: string): string {
  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return `You are CrewBot, an AI assistant built into CrewBooks — a CRM for roofing and HVAC contractors.

You are talking to the owner of "${businessName}", a ${trade || "contractor"} business.
Today is ${now}.
Business ID: ${businessId} (do not show this to the user)

You can help with:
- Looking up customers, jobs, and invoices
- Creating new customers, jobs, and invoices
- Updating job statuses and rescheduling appointments
- Sending invoices via SMS or email
- Checking business stats and upcoming schedule

IMPORTANT RULES:
1. Always confirm before creating, updating, or deleting anything. Describe what you're about to do and ask "Want me to go ahead?" — wait for a "yes" or "do it" before calling create/update tools.
2. Format all currency as $X,XXX.XX
3. Format dates in plain English: "Tuesday, April 15" not "2026-04-15"
4. Keep responses short and practical. These are busy tradespeople, not office workers.
5. If you need more info, ask ONE specific question at a time.
6. Never make up data. If a search returns nothing, say so.
7. When listing items, use clean numbered lists.
8. For status updates: "in progress" = actively working on site, "completed" = job done.
9. When creating an invoice, always ask for line items (description, qty, unit price) before calling createInvoice.
10. After creating a draft invoice, always ask if they want to send it right away.`;
}

// ── API route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // RBAC: resolve role and check ai:limited (granted to technicians+)
  const userRole = await getUserRole(admin, user.id);
  if (!userRole || !hasPermission(userRole.role, "ai:limited")) {
    return NextResponse.json({ error: "Forbidden: AI assistant not available for your role" }, { status: 403 });
  }

  // Get business (use businessId from role context)
  const { data: business } = await admin
    .from("businesses")
    .select("id, name, trade, subscription_status")
    .eq("id", userRole.businessId)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const b = business as { id: string; name: string; trade: string; subscription_status: string };

  // Check rate limit
  const { allowed, limit } = await checkRateLimit(b.id, b.subscription_status);
  if (!allowed) {
    return NextResponse.json({
      error: `You've reached your daily AI limit (${limit} messages). It resets at midnight. You can still use all CrewBooks features manually.`,
    }, { status: 429 });
  }

  // Parse request body — AI SDK v6 sends UIMessage[]
  const body = await req.json() as {
    messages: UIMessage[];
    conversationId?: string;
    context?: PageContext;
  };

  const { messages, conversationId, context } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    // Extract text from the first user message parts
    const firstUserMsg = messages.find((m) => m.role === "user");
    const firstText = firstUserMsg?.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "New conversation";
    const title = firstText.length > 60 ? firstText.slice(0, 57) + "…" : firstText;

    const { data: conv } = await admin
      .from("ai_conversations")
      .insert({ business_id: b.id, title } as never)
      .select("id")
      .single();
    convId = (conv as { id: string } | null)?.id;
  }

  // Check OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-...") {
    return NextResponse.json({
      error: "OpenAI API key not configured. Add OPENAI_API_KEY to your environment variables.",
    }, { status: 400 });
  }

  // Extract last user message text for saving
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg?.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("") ?? "";

  // Convert UIMessages → ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages);

  // Stream the response
  const tools = createCrewBotTools(b.id);

  const contextMsg = context ? buildContextSystemMessage(context) : "";
  const systemPrompt = contextMsg
    ? `${buildSystemPrompt(b.name, b.trade, b.id)}\n\n${contextMsg}`
    : buildSystemPrompt(b.name, b.trade, b.id);

  const result = streamText({
    model:      openai("gpt-4o-mini"),
    system:     systemPrompt,
    messages:   modelMessages,
    tools,
    stopWhen:   stepCountIs(5),
    temperature: 0.3,
    onFinish: async ({ text }) => {
      // Save messages + increment usage in parallel (non-blocking after response)
      await Promise.all([
        convId ? saveMessages(convId, lastUserText, text) : Promise.resolve(),
        incrementUsage(b.id),
      ]).catch(console.error);
    },
  });

  // Return streaming response with conversation ID in header
  const response = result.toUIMessageStreamResponse();

  if (convId) {
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", convId);
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  return response;
}
