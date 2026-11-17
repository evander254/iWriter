import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Switch,
  Textarea,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from "../../services";
import type { Announcement } from "../../types/models";
import { formatDateTime, formatRelative } from "../../utils/date";

const schema = z.object({
  title: z.string().min(3, "Add a title").max(120),
  message: z.string().min(5, "Add a message").max(1200),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function AdminAnnouncementsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, reload } = useAsync(() => listAnnouncements(false), []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", message: "", is_active: true },
  });

  const isActive = watch("is_active");

  const openCreate = () => {
    reset({ title: "", message: "", is_active: true });
    setCreating(true);
  };
  const openEdit = (item: Announcement) => {
    reset({ title: item.title ?? "", message: item.message ?? "", is_active: item.is_active });
    setEditing(item);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, values);
        toast.success("Announcement updated");
      } else {
        await createAnnouncement(values);
        toast.success("Announcement published");
      }
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error("Could not save announcement", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item: Announcement) => {
    try {
      await updateAnnouncement(item.id, { is_active: !item.is_active });
      toast.success(item.is_active ? "Announcement hidden" : "Announcement activated");
      reload();
    } catch (err) {
      toast.error("Could not update announcement", err instanceof Error ? err.message : undefined);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteAnnouncement(deleting.id);
      toast.success("Announcement deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Could not delete announcement", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!debounced.trim()) return list;
    const term = debounced.toLowerCase();
    return list.filter((a) => (a.title ?? "").toLowerCase().includes(term) || (a.message ?? "").toLowerCase().includes(term));
  }, [data, debounced]);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Announcements"
        description="Broadcast news and updates to every writer on the platform."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New announcement
          </Button>
        }
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search announcements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Badge tone="neutral">{filtered.length} total</Badge>
        </div>

        {loading ? (
          <Loading label="Loading announcements…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={search ? "No matching announcements" : "No announcements yet"}
            description={search ? "Try a different search term." : "Publish your first announcement to keep writers informed."}
            action={
              !search ? (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New announcement
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="iw-card__body stack iw-gap-4">
            {filtered.map((item) => (
              <Card key={item.id} className="iw-announcement">
                <div className="iw-between" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="iw-inline iw-gap-3">
                      <span className="iw-form-section__icon">
                        <Megaphone size={15} strokeWidth={2.2} />
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 650 }}>{item.title ?? "Announcement"}</h3>
                      <Badge tone={item.is_active ? "success" : "neutral"} dot>
                        {item.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="text-sm text-secondary iw-mt-3" style={{ whiteSpace: "pre-wrap" }}>
                      {item.message ?? ""}
                    </p>
                    <div className="text-xs text-muted iw-mt-3">
                      Created {formatDateTime(item.created_at)} · {formatRelative(item.created_at)}
                    </div>
                  </div>
                  <div className="iw-inline iw-gap-2">
                    <IconButton
                      icon={item.is_active ? EyeOff : Eye}
                      label={item.is_active ? "Hide" : "Show"}
                      size="sm"
                      onClick={() => void toggleActive(item)}
                    />
                    <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => openEdit(item)} />
                    <IconButton icon={Trash2} label="Delete" size="sm" onClick={() => setDeleting(item)} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit announcement" : "New announcement"}
        description="Announcements are visible to writers on their dashboard."
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
              {editing ? "Save changes" : "Publish announcement"}
            </Button>
          </>
        }
      >
        <div className="stack iw-gap-4">
          <Field label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" placeholder="e.g. New payout schedule" autoFocus {...register("title")} />
          </Field>
          <Field label="Message" htmlFor="message" required error={errors.message?.message}>
            <Textarea id="message" rows={5} placeholder="Write your announcement…" {...register("message")} />
          </Field>
          <label className="iw-inline iw-gap-3" style={{ cursor: "pointer" }}>
            <Switch checked={isActive} onChange={(e) => setValue("is_active", e.target.checked)} />
            <span className="text-sm">Publish immediately</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        tone="danger"
        title="Delete announcement?"
        description={`"${deleting?.title ?? "This announcement"}" will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
