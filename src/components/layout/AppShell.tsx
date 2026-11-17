import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useLocalStorage } from "../../hooks/useUi";
import { useTheme } from "../../hooks/useTheme";
import { navForRole, type AppRole } from "../../lib/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useNavBadges } from "../../hooks/useNavBadges";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

export interface AppShellProps {
  role: AppRole;
}

export function AppShell({ role }: AppShellProps) {
  const [collapsed, setCollapsed] = useLocalStorage("iwriter-sidebar-collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const sections = useMemo(() => navForRole(role), [role]);
  const badges = useNavBadges(role);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`live-platform-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        window.dispatchEvent(new CustomEvent("iw:realtime", { detail: payload }));
        if (payload.table === "notifications" && payload.eventType === "INSERT") {
          // A short, locally generated chime; no audio asset/network request.
          try {
            const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const audio = new AudioContextClass();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, audio.currentTime);
            oscillator.frequency.setValueAtTime(1175, audio.currentTime + 0.11);
            gain.gain.setValueAtTime(0.0001, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.32);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.33);
            oscillator.onended = () => void audio.close();
          } catch {
            // Browsers may block sound until the user interacts with the page.
          }
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const title = useMemo(() => {
    const all = sections.flatMap((s) => s.items);
    const matches = all
      .filter((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
      .sort((a, b) => b.to.length - a.to.length);
    return matches[0]?.label;
  }, [sections, location.pathname]);

  const base = role === "admin" ? "/admin" : "/writer";

  return (
    <div className="iw-shell" data-role={role} data-collapsed={collapsed}>
      <div className="iw-shell__sidebar">
        <Sidebar
          sections={sections}
          role={role}
          badges={badges}
          collapsed={collapsed}
          showFooter
        />
      </div>

      <div className="iw-shell__body">
        <Topbar
          title={title}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenMobileNav={() => setMobileOpen(true)}
          unreadCount={badges.unreadNotifications ?? 0}
          notificationsPath={`${base}/notifications`}
          profilePath={`${base}/profile`}
          homePath={base}
          theme={theme}
          onToggleTheme={toggle}
        />

        <main className="iw-shell__main" id="main-content">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div className="iw-mobile-drawer">
          <div className="iw-mobile-drawer__backdrop" onClick={() => setMobileOpen(false)} />
          <div className="iw-mobile-drawer__panel">
            <Sidebar
              sections={sections}
              role={role}
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
