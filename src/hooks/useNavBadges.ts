import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { AppRole } from "../types";

const EMPTY: Record<string, number> = {};

/**
 * Sidebar badge counts (pending items / unread notifications).
 * All failures are non-fatal — badges simply don't render.
 */
export function useNavBadges(role: AppRole): Record<string, number> {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Record<string, number>>(EMPTY);

  useEffect(() => {
    if (!user) {
      setBadges(EMPTY);
      return;
    }
    let cancelled = false;

    async function load() {
      const result: Record<string, number> = {};

      const count = async (key: string, query: PromiseLike<{ count: number | null }>) => {
        try {
          const { count: c } = await query;
          if (typeof c === "number" && c > 0) result[key] = c;
        } catch {
          /* ignore */
        }
      };

      if (role === "admin") {
        await count(
          "pendingSubmissions",
          supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        );
        await count(
          "pendingRevisions",
          supabase.from("revision_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        );
        await count(
          "pendingWithdrawals",
          supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        );
      } else {
        // revision_requests has no writer_id: resolve the writer's claim ids first.
        const { data: claims } = await supabase
          .from("assignment_claims")
          .select("id")
          .eq("writer_id", user!.id);
        const claimIds = (claims ?? []).map((c) => c.id);
        if (claimIds.length > 0) {
          const { data: submissions } = await supabase
            .from("submissions")
            .select("id")
            .in("claim_id", claimIds);
          const submissionIds = (submissions ?? []).map((submission) => submission.id);
          if (submissionIds.length > 0) {
            await count(
              "pendingRevisions",
              supabase
                .from("revision_requests")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending")
                .in("submission_id", submissionIds),
            );
          }
        }
        await count(
          "unreadNotifications",
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("is_read", false),
        );
      }

      if (!cancelled) setBadges(result);
    }

    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, role]);

  return badges;
}
