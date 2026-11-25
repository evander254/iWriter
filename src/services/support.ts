import { supabase } from "../lib/supabase";
import { uploadFile, type UploadedFile } from "./storage";

export interface SupportConversation {
  id: string;
  writer_id: string;
  created_at: string;
  updated_at: string;
  writer?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface SupportAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: SupportAttachment[];
  created_at: string;
  sender?: { id: string; full_name: string | null; role: string } | null;
}

export async function getOrCreateSupportConversation(writerId: string): Promise<SupportConversation> {
  const { data, error } = await supabase.rpc("get_or_create_support_conversation");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Could not open your support conversation.");
  const conversation = row as SupportConversation;
  if (conversation.writer_id !== writerId) throw new Error("The support conversation belongs to another account.");
  return conversation;
}

export async function listSupportConversations(): Promise<SupportConversation[]> {
  const { data, error } = await supabase.from("support_conversations").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const conversations = (data ?? []) as SupportConversation[];
  if (!conversations.length) return conversations;
  const { data: writers, error: profileError } = await supabase
    .from("profiles").select("id,full_name,email").in("id", conversations.map((item) => item.writer_id));
  if (profileError) throw new Error(profileError.message);
  const byId = new Map((writers ?? []).map((writer) => [writer.id, writer]));
  return conversations.map((item) => ({ ...item, writer: byId.get(item.writer_id) ?? null }));
}

export async function listSupportMessages(conversationId: string, viewerIsAdmin: boolean): Promise<SupportMessage[]> {
  const { data, error } = await supabase.from("support_messages").select("*").eq("conversation_id", conversationId).order("created_at");
  if (error) throw new Error(error.message);
  const messages = (data ?? []) as SupportMessage[];
  if (!viewerIsAdmin || !messages.length) return messages;
  const senderIds = [...new Set(messages.map((message) => message.sender_id))];
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,full_name,role").in("id", senderIds);
  if (profileError) throw new Error(profileError.message);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return messages.map((message) => ({ ...message, sender: byId.get(message.sender_id) ?? null }));
}

export async function sendSupportMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  files: File[];
}): Promise<void> {
  if (input.files.length > 5) throw new Error("Attach up to 5 files per message.");
  const uploaded: UploadedFile[] = [];
  for (const file of input.files) uploaded.push(await uploadFile("support", input.conversationId, file, "support-attachments"));
  const attachments: SupportAttachment[] = uploaded.map(({ path, name, size, type }) => ({ path, name, size, type }));
  const { error } = await supabase.from("support_messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body: input.body.trim(),
    attachments,
  });
  if (error) throw new Error(error.message);
}
