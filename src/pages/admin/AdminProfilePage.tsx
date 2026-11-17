import { ProfileForm } from "../../components/profile/ProfileForm";
import { PageHeader } from "../../components/common";

export function AdminProfilePage() {
  return (
    <div className="animate-fade">
      <PageHeader title="My profile" description="Manage your administrator account details." />
      <ProfileForm />
    </div>
  );
}
