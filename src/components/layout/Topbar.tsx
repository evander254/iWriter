import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserCog, LogOut, LayoutDashboard } from "lucide-react";
import { Dropdown, Avatar, IconButton } from "../common";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationDropdown } from "../notifications/NotificationDropdown";

export interface TopbarProps {
  title?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenMobileNav?: () => void;
  unreadCount?: number;
  notificationsPath: string;
  profilePath: string;
  homePath: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Topbar({
  title,
  collapsed,
  onToggleCollapse,
  onOpenMobileNav,
  unreadCount = 0,
  notificationsPath,
  profilePath,
  homePath,
  theme,
  onToggleTheme,
}: TopbarProps) {
  const { user, profile, signOut } = useAuth();

  return (
    <header className="iw-topbar">
      <div className="iw-mobilenav">
        <IconButton icon={Menu} label="Open navigation" onClick={onOpenMobileNav} />
      </div>

      {onToggleCollapse && (
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapse}
          className="iw-hide-mobile"
        />
      )}

      {title && <h1 className="iw-topbar__title truncate">{title}</h1>}

      <div className="iw-topbar__actions">
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleTheme}
        />
        {user && <NotificationDropdown userId={user.id} unreadCount={unreadCount} notificationsPath={notificationsPath} />}

        <Dropdown
          trigger={
            <button type="button" className="iw-iconbtn" aria-label="Account menu" style={{ width: "auto", padding: "0 6px", gap: 8, display: "flex" }}>
              <Avatar name={profile?.full_name ?? profile?.email} src={profile?.avatar_url} size="sm" />
            </button>
          }
          items={[
            { label: profile?.full_name || "My account" },
            {
              label: "Dashboard",
              icon: LayoutDashboard,
              onClick: () => {
                window.location.href = homePath;
              },
            },
            { label: "My profile", icon: UserCog, onClick: () => { window.location.href = profilePath; } },
            "divider",
            { label: "Sign out", icon: LogOut, danger: true, onClick: () => void signOut() },
          ]}
        />
      </div>
    </header>
  );
}
