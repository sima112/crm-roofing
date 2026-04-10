"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UIMessage } from "ai";

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function getConversationsAction(): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("business_id", (biz as { id: string }).id)
    .order("updated_at", { ascending: false })
    .limit(30);

  return (data ?? []) as ConversationSummary[];
}

export async function getConversationMessagesAction(
  conversationId: string
): Promise<UIMessage[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();

  // Verify ownership: conversation → business → owner
  const { data: conv } = await admin
    .from("ai_conversations")
    .select("id, business_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return [];

  const { data: biz } = await admin
    .from("businesses")
    .select("owner_id")
    .eq("id", (conv as { business_id: string }).business_id)
    .maybeSingle();

  if ((biz as { owner_id: string } | null)?.owner_id !== user.id) return [];

  const { data: messages } = await admin
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!messages) return [];

  return (messages as { id: string; role: string; content: string }[]).map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: msg.content }],
  }));
}

export type AiSettings = {
  ai_enabled: boolean;
  daily_briefing_enabled: boolean;
  daily_briefing_time: string;
  daily_briefing_phone: string | null;
  smart_suggestions_enabled: boolean;
};

export async function getAiSettingsAction(): Promise<AiSettings> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const defaults: AiSettings = {
    ai_enabled: true,
    daily_briefing_enabled: true,
    daily_briefing_time: "07:00",
    daily_briefing_phone: null,
    smart_suggestions_enabled: true,
  };

  if (!user) return defaults;

  const { data } = await supabase
    .from("businesses")
    .select("ai_enabled, daily_briefing_enabled, daily_briefing_time, daily_briefing_phone, smart_suggestions_enabled")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return defaults;
  const d = data as Partial<AiSettings>;

  return {
    ai_enabled:                d.ai_enabled               ?? true,
    daily_briefing_enabled:    d.daily_briefing_enabled    ?? true,
    daily_briefing_time:       d.daily_briefing_time       ?? "07:00",
    daily_briefing_phone:      d.daily_briefing_phone      ?? null,
    smart_suggestions_enabled: d.smart_suggestions_enabled ?? true,
  };
}

export async function saveAiSettingsAction(
  settings: Partial<AiSettings>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("businesses")
    .update(settings as never)
    .eq("owner_id", user.id);

  return { error: error?.message ?? null };
}
