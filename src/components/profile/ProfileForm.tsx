import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Check, Mail, MapPin, Phone, Save, ShieldCheck, UserCog } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardHeader, Field, FieldRow, Input, Textarea } from "../common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { updateMyProfile, uploadFile, STORAGE_FOLDERS, getSignedUrl } from "../../services";
import { displayName } from "../../types";
import { ROLE_LABEL } from "../../lib/navigation";
import { formatDate } from "../../utils/date";

const schema = z.object({
  full_name: z.string().min(2, "Enter your full name").max(120),
  phone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  bio: z.string().max(600, "Keep your bio under 600 characters").optional(),
});

type FormValues = z.infer<typeof schema>;

const AVATAR_STYLES = [
  { id: "iron-man", name: "Iron Man", url: "/avatars/01-iron-man.svg" },
  { id: "captain-america", name: "Captain America", url: "/avatars/02-captain-america.svg" },
  { id: "black-widow", name: "Black Widow", url: "/avatars/03-black-widow.svg" },
  { id: "agent-carter", name: "Agent Carter", url: "/avatars/04-agent-carter.svg" },
  { id: "hulk", name: "Hulk", url: "/avatars/05-hulk.svg" },
  { id: "she-hulk", name: "She-Hulk", url: "/avatars/06-she-hulk.svg" },
  { id: "spider-man", name: "Spider-Man", url: "/avatars/07-spider-man.svg" },
  { id: "moon-knight", name: "Moon Knight", url: "/avatars/08-moon-knight.svg" },
  { id: "black-panther", name: "Black Panther", url: "/avatars/09-black-panther.svg" },
  { id: "sue-storm", name: "Sue Storm", url: "/avatars/10-sue-storm.svg" },
  { id: "deadpool", name: "Deadpool", url: "/avatars/11-deadpool.svg" },
  { id: "spider-gwen", name: "Spider-Gwen", url: "/avatars/12-spider-gwen.svg" },
  { id: "ant-man", name: "Ant-Man", url: "/avatars/13-ant-man.svg" },
  { id: "wasp", name: "Wasp", url: "/avatars/14-wasp.svg" },
];

export function ProfileForm() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", phone: "", country: "", bio: "" },
  });

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        country: profile.country ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile, reset]);

  useEffect(() => {
    let cancelled = false;
    if (profile?.avatar_url) {
      if (profile.avatar_url.startsWith("data:") || profile.avatar_url.startsWith("/avatars/")) {
        setAvatarUrl(profile.avatar_url);
        return () => { cancelled = true; };
      }
      void getSignedUrl(profile.avatar_url).then((url) => {
        if (!cancelled && url) setAvatarUrl(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  if (!profile) return null;

  const onSubmit = async (values: FormValues) => {
    try {
      await updateMyProfile(profile.id, {
        full_name: values.full_name.trim(),
        phone: values.phone?.trim() || null,
        country: values.country?.trim() || null,
        bio: values.bio?.trim() || null,
      });
      await refreshProfile();
      toast.success("Profile updated", "Your details have been saved.");
    } catch (err) {
      toast.error("Could not save profile", err instanceof Error ? err.message : undefined);
    }
  };

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(STORAGE_FOLDERS.profiles, profile.id, file);
      await updateMyProfile(profile.id, { avatar_url: uploaded.path });
      await refreshProfile();
      const url = await getSignedUrl(uploaded.path);
      setAvatarUrl(url);
      toast.success("Photo updated");
    } catch (err) {
      toast.error("Could not upload photo", err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSelectPreset = async (url: string) => {
    try {
      await updateMyProfile(profile.id, { avatar_url: url });
      setAvatarUrl(url);
      await refreshProfile();
      toast.success("Avatar updated", "Your new profile avatar is ready.");
    } catch (err) {
      toast.error("Could not update avatar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="iw-grid iw-grid--2-1">
      <Card flush>
        <CardHeader
          icon={UserCog}
          title="Personal information"
          subtitle="This is how your name and details appear across iWriter."
        />
        <form className="iw-card__body stack iw-gap-5" onSubmit={handleSubmit(onSubmit)}>
          <FieldRow>
            <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
              <Input id="full_name" placeholder="Jane Doe" icon={UserCog} {...register("full_name")} />
            </Field>
            <Field label="Email address" htmlFor="email" hint="Managed by your account — contact support to change">
              <Input id="email" value={profile.email ?? ""} icon={Mail} readOnly disabled />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" placeholder="+1 555 000 1234" icon={Phone} {...register("phone")} />
            </Field>
            <Field label="Country" htmlFor="country" error={errors.country?.message}>
              <Input id="country" placeholder="United States" icon={MapPin} {...register("country")} />
            </Field>
          </FieldRow>

          <Field label="Bio" htmlFor="bio" hint="A short introduction shown on your profile" error={errors.bio?.message}>
            <Textarea id="bio" rows={4} placeholder="Tell the team about your academic background and expertise…" {...register("bio")} />
          </Field>

          <div className="iw-inline iw-gap-3">
            <Button type="submit" variant="primary" icon={Save} loading={isSubmitting} disabled={!isDirty && !isSubmitting}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  full_name: profile.full_name ?? "",
                  phone: profile.phone ?? "",
                  country: profile.country ?? "",
                  bio: profile.bio ?? "",
                })
              }
              disabled={!isDirty}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <div className="stack iw-gap-5">
        <Card flush>
          <CardHeader title="Profile avatar" subtitle="Choose a professional style or upload your own photo." />
          <div className="iw-card__body stack iw-gap-4" style={{ alignItems: "center", textAlign: "center" }}>
            <Avatar name={displayName(profile)} src={avatarUrl} size="xl" />
            <div className="stack iw-gap-2" style={{ width: "100%" }}>
              <strong className="text-sm">Choose your look</strong>
              <div role="group" aria-label="Choose a profile avatar" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {AVATAR_STYLES.map((avatar) => {
                  const selected = profile.avatar_url === avatar.url;
                  return (
                    <button key={avatar.id} type="button" aria-label={`${avatar.name} avatar${selected ? ", selected" : ""}`} aria-pressed={selected} onClick={() => void onSelectPreset(avatar.url)} title={avatar.name} style={{ position: "relative", border: selected ? "2px solid var(--color-accent, #587d68)" : "2px solid transparent", borderRadius: 14, background: "var(--surface, #fff)", padding: 4, cursor: "pointer" }}>
                      <img src={avatar.url} alt="" style={{ width: "100%", display: "block", borderRadius: "50%" }} />
                      {selected && <Check size={15} aria-hidden="true" style={{ position: "absolute", right: 0, top: 0, background: "var(--color-accent, #587d68)", color: "white", borderRadius: "50%", padding: 2 }} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">12 original styles, made to look right across your writer profile.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onPickAvatar(e.target.files?.[0])}
            />
            <Button variant="outline" icon={Camera} loading={uploading} onClick={() => fileRef.current?.click()}>
              {profile.avatar_url ? "Change photo" : "Upload photo"}
            </Button>
            <p className="text-xs text-muted">PNG, JPG or WEBP up to 25 MB.</p>
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Account" subtitle="Your role and membership details." />
          <div className="iw-card__body stack iw-gap-4">
            <div className="iw-between">
              <span className="text-sm text-secondary">Role</span>
              <Badge tone="accent" icon={ShieldCheck}>
                {ROLE_LABEL[profile.role]}
              </Badge>
            </div>
            <div className="iw-divider" />
            <div className="iw-between">
              <span className="text-sm text-secondary">Member since</span>
              <span className="text-sm font-medium">{formatDate(profile.created_at)}</span>
            </div>
            <div className="iw-divider" />
            <div className="iw-between">
              <span className="text-sm text-secondary">Account status</span>
              <Badge tone={profile.status === "active" ? "success" : profile.status === "suspended" ? "danger" : "neutral"} dot>
                {profile.status}
              </Badge>
            </div>
          </div>
        </Card>

        {profile.status === "suspended" && (
          <Alert tone="warning" title="Account suspended">
            Your account is currently suspended. You can view data but cannot claim or submit work. Contact an administrator.
          </Alert>
        )}
      </div>
    </div>
  );
}
