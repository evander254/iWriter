import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, LogOut, Moon, Palette, ShieldCheck, Sun } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader, Field, FieldRow, Input } from "../common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../hooks/useTheme";
import { displayName } from "../../types";
import { ROLE_LABEL } from "../../lib/navigation";
import { formatDate } from "../../utils/date";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string().min(8, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof schema>;

export function AccountSettings() {
  const { profile, user, updatePassword, signOut } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      const { error } = await updatePassword(values.password);
      if (error) throw new Error(error);
      toast.success("Password updated", "Use your new password next time you sign in.");
      reset({ password: "", confirm: "" });
    } catch (err) {
      toast.error("Could not update password", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="iw-grid iw-grid--2-1">
      <div className="stack iw-gap-5">
        <Card flush>
          <CardHeader icon={KeyRound} title="Change password" subtitle="Keep your account secure with a strong password." />
          <form className="iw-card__body stack iw-gap-4" onSubmit={handleSubmit(onSubmit)}>
            <FieldRow>
              <Field label="New password" htmlFor="password" required error={errors.password?.message}>
                <Input id="password" type="password" autoComplete="new-password" icon={KeyRound} {...register("password")} />
              </Field>
              <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm?.message}>
                <Input id="confirm" type="password" autoComplete="new-password" icon={KeyRound} {...register("confirm")} />
              </Field>
            </FieldRow>
            <div className="iw-inline iw-gap-3">
              <Button type="submit" variant="primary" loading={busy}>
                Update password
              </Button>
            </div>
          </form>
        </Card>

        <Card flush>
          <CardHeader icon={Palette} title="Appearance" subtitle="Choose how iWriter looks to you." />
          <div className="iw-card__body">
            <div className="iw-grid iw-grid--halves">
              <button
                type="button"
                className={`iw-theme-option${theme === "light" ? " is-active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <Sun size={20} />
                <span>Light</span>
                {theme === "light" && <Badge tone="accent">Active</Badge>}
              </button>
              <button
                type="button"
                className={`iw-theme-option${theme === "dark" ? " is-active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <Moon size={20} />
                <span>Dark</span>
                {theme === "dark" && <Badge tone="accent">Active</Badge>}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="stack iw-gap-5">
        <Card flush>
          <CardHeader icon={ShieldCheck} title="Account" subtitle="Your identity on iWriter." />
          <div className="iw-card__body stack iw-gap-4">
            <div className="iw-between">
              <span className="text-sm text-secondary">Name</span>
              <span className="text-sm font-medium">{displayName(profile)}</span>
            </div>
            <div className="iw-divider" />
            <div className="iw-between">
              <span className="text-sm text-secondary">Email</span>
              <span className="text-sm font-medium truncate" style={{ maxWidth: 180 }}>
                {profile?.email ?? user?.email ?? "—"}
              </span>
            </div>
            <div className="iw-divider" />
            <div className="iw-between">
              <span className="text-sm text-secondary">Role</span>
              <Badge tone="accent">{profile ? ROLE_LABEL[profile.role] : "—"}</Badge>
            </div>
            <div className="iw-divider" />
            <div className="iw-between">
              <span className="text-sm text-secondary">Member since</span>
              <span className="text-sm">{formatDate(profile?.created_at)}</span>
            </div>
          </div>
        </Card>

        <Alert tone="info" title="Session">
          Signing out will end this session on this device. Any unsaved changes will be lost.
        </Alert>

        <Button variant="danger-soft" icon={LogOut} onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
