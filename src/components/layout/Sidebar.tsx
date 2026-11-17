import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, PenLine, ShieldCheck } from "lucide-react";
import { cx } from "../../lib/utils";
import { ROLE_LABEL, type AppRole, type NavSection } from "../../lib/navigation";
import { Avatar } from "../common";
import { useAuth } from "../../contexts/AuthContext";

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="iw-sidebar__brand" style={compact ? { justifyContent: "center", padding: 0 } : undefined}>
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "linear-gradient(140deg, var(--color-accent), var(--color-accent-2))",
          color: "#fff",
          boxShadow: "var(--shadow-accent)",
          flex: "none",
        }}
      >
        <PenLine size={18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <>
          <span className="iw-sidebar__brand-text">iWriter</span>
          <span className="iw-sidebar__brand-badge">.co.ke</span>
        </>
      )}
    </div>
  );
}

export interface SidebarProps {
  sections: NavSection[];
  role: AppRole;
  badges?: Record<string, number>;
  collapsed?: boolean;
  onNavigate?: () => void;
  showFooter?: boolean;
}

export function Sidebar({ sections, role, badges = {}, collapsed, onNavigate, showFooter = true }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="iw-sidebar" aria-label="Primary navigation">
      <Brand compact={collapsed} />
      {!collapsed && (
        <div className={`iw-sidebar__portal iw-sidebar__portal--${role}`}>
          {role === "admin" ? <ShieldCheck size={15} /> : <PenLine size={15} />}
          <span>{role === "admin" ? "Admin console" : "Writer workspace"}</span>
        </div>
      )}

      <nav className="iw-sidebar__scroll">
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && <div className="iw-sidebar__section-label">{section.label}</div>}
            <div className="iw-sidebar__nav">
              {section.items.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? badges[item.badge] ?? 0 : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => cx("iw-sidebar__link", isActive && "is-active")}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="iw-sidebar__link-icon">
                      <Icon size={18} strokeWidth={2.05} />
                    </span>
                    <span className="iw-sidebar__link-label">{item.label}</span>
                    {count > 0 && <span className="iw-sidebar__link-badge">{count > 99 ? "99+" : count}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {showFooter && (
        <div className="iw-sidebar__footer">
          <div className="iw-sidebar__user">
            <Avatar name={profile?.full_name ?? profile?.email} src={profile?.avatar_url} size="sm" />
            <span className="iw-sidebar__user-meta">
              <span className="iw-sidebar__user-name truncate" style={{ display: "block" }}>
                {profile?.full_name || "Account"}
              </span>
              <span className="iw-sidebar__user-role">{ROLE_LABEL[profile?.role ?? "writer"]}</span>
            </span>
            <button
              type="button"
              className="iw-iconbtn"
              style={{ width: 30, height: 30 }}
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
