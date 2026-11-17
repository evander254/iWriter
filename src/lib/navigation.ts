import {
  Activity,
  Award,
  Bell,
  Briefcase,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileClock,
  FolderTree,
  Gauge,
  GraduationCap,
  LayoutGrid,
  Megaphone,
  RefreshCcw,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "admin" | "writer";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Badge source key resolved by the layout (e.g. pending counts). */
  badge?: string;
  end?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: "Overview", to: "/admin", icon: Gauge, end: true },
      { label: "Assignments", to: "/admin/assignments", icon: ClipboardList },
      { label: "Assignment Claims", to: "/admin/claims", icon: Briefcase },
      { label: "Submissions", to: "/admin/submissions", icon: FileCheck2, badge: "pendingSubmissions" },
      { label: "Revisions", to: "/admin/revisions", icon: RefreshCcw, badge: "pendingRevisions" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Writers", to: "/admin/writers", icon: Users },
      { label: "Subjects", to: "/admin/subjects", icon: GraduationCap },
      { label: "Categories", to: "/admin/categories", icon: FolderTree },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Financial Management", to: "/admin/finance", icon: CreditCard },
      { label: "Withdrawals", to: "/admin/withdrawals", icon: Wallet, badge: "pendingWithdrawals" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Announcements", to: "/admin/announcements", icon: Megaphone },
      { label: "Activity Logs", to: "/admin/activity", icon: Activity },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "My Profile", to: "/admin/profile", icon: UserCog },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

export const WRITER_NAV: NavSection[] = [
  {
    items: [
      { label: "Overview", to: "/writer", icon: LayoutGrid, end: true },
      { label: "Browse Assignments", to: "/writer/assignments", icon: Award },
      { label: "My Assignments", to: "/writer/my-assignments", icon: ClipboardList },
      { label: "Submissions", to: "/writer/submissions", icon: FileCheck2 },
      { label: "Revisions", to: "/writer/revisions", icon: FileClock, badge: "pendingRevisions" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "My Wallet", to: "/writer/wallet", icon: Wallet },
      { label: "Transactions", to: "/writer/transactions", icon: CreditCard },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications", to: "/writer/notifications", icon: Bell, badge: "unreadNotifications" },
      { label: "Announcements", to: "/writer/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "My Profile", to: "/writer/profile", icon: UserCog },
      { label: "Settings", to: "/writer/settings", icon: Settings },
    ],
  },
];

export function navForRole(role: AppRole | null | undefined): NavSection[] {
  if (role === "admin") return ADMIN_NAV;
  return WRITER_NAV;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  writer: "Writer",
};

export const ROLE_ICON: Record<AppRole, LucideIcon> = {
  admin: ShieldCheck,
  writer: GraduationCap,
};
