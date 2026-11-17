import { ProfileForm } from "../../components/profile/ProfileForm";
import { PageHeader } from "../../components/common";

export function WriterProfilePage() {
  return (
    <div className="animate-fade">
      <PageHeader title="My profile" description="Keep your details and photo up to date." />
      <ProfileForm />
    </div>
  );
}
