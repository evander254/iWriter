import { supabase } from "../lib/supabase";
import { pageRange, unwrapList } from "./api";
import type { AppNotification, ListParams, Paginated } from "../types/models";

export interface NotificationFilters extends ListParams {
  userId?: string;
  unreadOnly?: boolean;
}

export async function listNotifications(
  userId: string,
  filters: NotificationFilters = {},
): Promise<Paginated<AppNotification>> {
  const { page = 1, pageSize = 15 } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (filters.unreadOnly) query = query.eq("is_read", false);
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  return { rows: unwrapList(data as AppNotification[] | null, error), count: count ?? 0, page, pageSize };
}

export async function listRecentNotifications(userId: string, limit = 6): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as AppNotification[] | null, error);
}

export async function getNotification(userId: string, notificationId: string): Promise<AppNotification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("id", notificationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppNotification | null) ?? null;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await supabase.from("notifications").update({ is_read: read }).eq("id", id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.rpc("mark_all_notifications_read");
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from("notifications").delete().eq("id", id);
}

/* ---------------- Announcements ---------------- */

export async function listAnnouncements(activeOnly = true) {
  let query = supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  return unwrapList(data, error);
}

export async function createAnnouncement(input: { title: string; message: string; is_active: boolean }) {
  const { data, error } = await supabase.from("announcements").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAnnouncement(
  id: string,
  input: { title?: string; message?: string; is_active?: boolean },
) {
  const { data, error } = await supabase.from("announcements").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from("announcements").delete().eq("id", id);
}
