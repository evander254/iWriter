import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-dispatch-secret",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!expectedSecret || request.headers.get("x-push-dispatch-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) {
    return new Response("Push sender is not configured", { status: 500 });
  }

  let notificationId: string;
  try {
    ({ notification_id: notificationId } = await request.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!notificationId) return new Response("notification_id is required", { status: 400 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("id, user_id, title, message")
    .eq("id", notificationId)
    .single();
  if (notificationError || !notification?.user_id) return new Response("Notification not found", { status: 404 });

  const [{ data: profile }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", notification.user_id).maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint, subscription").eq("user_id", notification.user_id),
  ]);
  if (subscriptionsError) return new Response(subscriptionsError.message, { status: 500 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const route = profile?.role === "admin" ? "/admin/notifications" : "/writer/notifications";
  const payload = JSON.stringify({
    notificationId: notification.id,
    title: notification.title || "iWriter notification",
    body: notification.message || "You have a new notification.",
    url: `${route}#notification-${notification.id}`,
  });

  const results = await Promise.all((subscriptions ?? []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      return null;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
      return error;
    }
  }));

  const failed = results.filter(Boolean).length;
  return new Response(JSON.stringify({ sent: (subscriptions?.length ?? 0) - failed, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
