import { NotificationCenter } from "../../components/notifications/NotificationCenter";
import { useAuth } from "../../contexts/AuthContext";
import { Loading } from "../../components/common";

export function AdminNotificationsPage() {
  const { user } = useAuth();
  if (!user) return <Loading full />;
  return (
    <NotificationCenter
      userId={user.id}
      title="Notifications"
      description="System alerts about claims, submissions, withdrawals and account activity."
    />
  );
}
