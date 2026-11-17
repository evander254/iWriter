import { NotificationCenter } from "../../components/notifications/NotificationCenter";
import { useAuth } from "../../contexts/AuthContext";
import { Loading } from "../../components/common";

export function WriterNotificationsPage() {
  const { user } = useAuth();
  if (!user) return <Loading full />;
  return (
    <NotificationCenter
      userId={user.id}
      title="Notifications"
      description="Updates about your claims, submissions, revisions and wallet."
    />
  );
}
