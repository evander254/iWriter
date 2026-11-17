import { AccountSettings } from "../../components/profile/AccountSettings";
import { PageHeader } from "../../components/common";

export function WriterSettingsPage() {
  return (
    <div className="animate-fade">
      <PageHeader title="Settings" description="Manage your password, appearance and session." />
      <AccountSettings />
    </div>
  );
}
