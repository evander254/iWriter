import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Database, Pencil, Plus, Settings as SettingsIcon, ShieldCheck, Trash2, Wrench } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Table,
  Td,
  Textarea,
  Th,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { deleteSetting, listSettings, upsertSetting } from "../../services";
import { STORAGE_BUCKET, supabase } from "../../lib/supabase";
import type { Setting } from "../../types/models";
import { formatDateTime } from "../../utils/date";
import { useMemo } from "react";

const schema = z.object({
  setting_key: z.string().min(2, "Add a key").max(60).regex(/^[a-z0-9_.]+$/, "Use lowercase letters, numbers, dots or underscores"),
  setting_value: z.string().max(2000),
  description: z.string().max(240).optional(),
});
type FormValues = z.infer<typeof schema>;

export function AdminSettingsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Setting | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Setting | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, reload } = useAsync(() => listSettings(), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { setting_key: "", setting_value: "", description: "" } });

  const openCreate = () => {
    reset({ setting_key: "", setting_value: "", description: "" });
    setCreating(true);
  };
  const openEdit = (setting: Setting) => {
    reset({
      setting_key: setting.setting_key ?? "",
      setting_value: setting.setting_value ?? "",
      description: setting.description ?? "",
    });
    setEditing(setting);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      await upsertSetting({
        setting_key: values.setting_key.trim(),
        setting_value: values.setting_value,
        description: values.description?.trim() || null,
      });
      toast.success(editing ? "Setting updated" : "Setting created");
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error("Could not save setting", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSetting(deleting.id);
      toast.success("Setting removed");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Could not remove setting", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!debounced.trim()) return list;
    const term = debounced.toLowerCase();
    return list.filter(
      (s) => (s.setting_key ?? "").toLowerCase().includes(term) || (s.description ?? "").toLowerCase().includes(term),
    );
  }, [data, debounced]);

  const projectRef = supabase.auth ? new URL(supabaseUrl()).hostname.split(".")[0] : "—";

  return (
    <div className="animate-fade">
      <PageHeader
        title="Settings"
        description="Platform-wide configuration stored in the settings table."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New setting
          </Button>
        }
      />

      <div className="iw-grid iw-grid--2-1">
        <Card flush>
          <CardHeader title="Configuration" subtitle={`${filtered.length} setting(s)`} />
          <div className="iw-toolbar">
            <SearchInput
              className="iw-toolbar__grow"
              placeholder="Search settings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Loading label="Loading settings…" />
          ) : error ? (
            <ErrorState description={error} onRetry={reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={search ? "No matching settings" : "No settings yet"}
              description={search ? "Try a different search." : "Create key/value settings to configure the platform."}
              action={
                !search ? (
                  <Button variant="primary" icon={Plus} onClick={openCreate}>
                    New setting
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Key</Th>
                  <Th>Value</Th>
                  <Th>Updated</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((setting) => (
                  <tr key={setting.id}>
                    <Td>
                      <div className="iw-table__primary mono">{setting.setting_key ?? "—"}</div>
                      {setting.description && <div className="iw-table__sub">{setting.description}</div>}
                    </Td>
                    <Td>
                      <span className="text-sm truncate" style={{ maxWidth: 280, display: "inline-block" }}>
                        {setting.setting_value || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatDateTime(setting.updated_at)}</span>
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => openEdit(setting)} />
                        <IconButton icon={Trash2} label="Delete" size="sm" onClick={() => setDeleting(setting)} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader icon={Database} title="Backend" subtitle="Live Supabase project" />
            <div className="iw-card__body">
              <DescriptionList
                items={[
                  { label: "Project", value: <span className="mono">{projectRef}</span> },
                  { label: "Storage bucket", value: <span className="mono">{STORAGE_BUCKET}</span> },
                  { label: "Auth", value: <Badge tone="success" icon={ShieldCheck}>Enabled</Badge> },
                  { label: "Row level security", value: <Badge tone="success">Enforced</Badge> },
                ]}
              />
            </div>
          </Card>

          <Alert tone="info" title="Security model">
            All sensitive operations — claiming, submitting, reviewing, earnings and withdrawals — run inside
            server-side functions. The client never computes balances or claim limits.
          </Alert>

          <Card flush>
            <CardHeader icon={SettingsIcon} title="Maintenance" subtitle="Careful — these affect the whole platform" />
            <div className="iw-card__body stack iw-gap-3">
              <div className="iw-between">
                <span className="text-sm text-secondary">Notification polling</span>
                <Badge tone="accent">60s</Badge>
              </div>
              <div className="iw-between">
                <span className="text-sm text-secondary">Max upload size</span>
                <Badge tone="accent">25 MB</Badge>
              </div>
              <div className="iw-between">
                <span className="text-sm text-secondary">Signed URL lifetime</span>
                <Badge tone="accent">1 hour</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit setting" : "New setting"}
        description="Settings are simple key/value pairs stored in the database."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={handleSubmit(onSubmit)}>
              {editing ? "Save changes" : "Create setting"}
            </Button>
          </>
        }
      >
        <div className="stack iw-gap-4">
          <Field label="Key" htmlFor="setting_key" required hint="Lowercase, e.g. platform_name" error={errors.setting_key?.message}>
            <Input id="setting_key" placeholder="platform_name" autoFocus disabled={Boolean(editing)} {...register("setting_key")} />
          </Field>
          <Field label="Value" htmlFor="setting_value" required error={errors.setting_value?.message}>
            <Textarea id="setting_value" rows={3} placeholder="iWriter" {...register("setting_value")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Input id="description" placeholder="What does this setting control?" {...register("description")} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        tone="danger"
        title="Delete setting?"
        description={`"${deleting?.setting_key ?? "This setting"}" will be removed permanently.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function supabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? "https://example.supabase.co";
}
