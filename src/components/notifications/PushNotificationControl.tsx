import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "../common";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function decodeVapidKey(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

export function PushNotificationControl({ userId }: { userId: string }) {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSupported(available);
      if (!available) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        setEnabled(Boolean(await registration?.pushManager.getSubscription()));
      } catch {
        setEnabled(false);
      }
    };
    void check();
  }, []);

  const enable = async () => {
    if (!vapidPublicKey) {
      toast.error("Push notifications are not configured", "Set VITE_VAPID_PUBLIC_KEY and deploy the push sender first.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow notifications in your browser settings to continue.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(vapidPublicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: subscription.endpoint, subscription: json },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(error.message);
      setEnabled(true);
      toast.success("Device notifications enabled", "New alerts will appear even when iWriter is not open.");
    } catch (err) {
      toast.error("Could not enable notifications", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint);
        if (error) throw new Error(error.message);
        await subscription.unsubscribe();
      }
      setEnabled(false);
      toast.success("Device notifications disabled");
    } catch (err) {
      toast.error("Could not disable notifications", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;
  return (
    <Button
      variant="outline"
      icon={enabled ? BellOff : Bell}
      loading={busy}
      onClick={() => void (enabled ? disable() : enable())}
      title={enabled ? "Turn off notifications for this device" : "Enable notifications on this device"}
    >
      {enabled ? "Disable device alerts" : "Enable device alerts"}
    </Button>
  );
}
