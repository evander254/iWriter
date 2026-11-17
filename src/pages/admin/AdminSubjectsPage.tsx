import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import {
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
  Table,
  Td,
  Th,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "../../services";
import { supabase } from "../../lib/supabase";
import type { Subject } from "../../types/models";
import { formatDate } from "../../utils/date";

const schema = z.object({
  name: z.string().min(2, "Enter a subject name").max(80, "Name is too long"),
});
type FormValues = z.infer<typeof schema>;

export function AdminSubjectsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, reload } = useAsync(async () => {
    const [subjects, assignments] = await Promise.all([
      listSubjects(),
      supabase.from("assignments").select("subject_id"),
    ]);
    const counts = new Map<string, number>();
    for (const row of assignments.data ?? []) {
      if (!row.subject_id) continue;
      counts.set(row.subject_id, (counts.get(row.subject_id) ?? 0) + 1);
    }
    return { subjects, counts };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  const openCreate = () => {
    reset({ name: "" });
    setCreating(true);
  };
  const openEdit = (subject: Subject) => {
    reset({ name: subject.name });
    setEditing(subject);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      if (editing) {
        await updateSubject(editing.id, values);
        toast.success("Subject updated");
      } else {
        await createSubject(values);
        toast.success("Subject created");
      }
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error("Could not save subject", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSubject(deleting.id);
      toast.success("Subject deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Could not delete subject", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const list = data?.subjects ?? [];
    if (!debounced.trim()) return list;
    const term = debounced.toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(term));
  }, [data, debounced]);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Subjects"
        description="Academic subjects used to classify assignments in the marketplace."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New subject
          </Button>
        }
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-secondary">{filtered.length} subjects</span>
        </div>

        {loading ? (
          <Loading label="Loading subjects…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={search ? "No matching subjects" : "No subjects yet"}
            description={search ? "Try a different search term." : "Add your first subject so assignments can be classified."}
            action={
              !search ? (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New subject
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Subject</Th>
                <Th numeric>Assignments</Th>
                <Th>Created</Th>
                <Th className="iw-table__num">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((subject) => (
                <tr key={subject.id}>
                  <Td>
                    <span className="iw-table__primary">{subject.name}</span>
                  </Td>
                  <Td numeric>{data?.counts.get(subject.id) ?? 0}</Td>
                  <Td>{formatDate(subject.created_at)}</Td>
                  <Td>
                    <div className="iw-table__actions">
                      <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => openEdit(subject)} />
                      <IconButton icon={Trash2} label="Delete" size="sm" onClick={() => setDeleting(subject)} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit subject" : "New subject"}
        description={editing ? "Update the subject name." : "Subjects group assignments by academic discipline."}
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
              {editing ? "Save changes" : "Create subject"}
            </Button>
          </>
        }
      >
        <Field label="Subject name" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" placeholder="e.g. Business & Management" autoFocus {...register("name")} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        tone="danger"
        title="Delete subject?"
        description={`"${deleting?.name}" will be removed. Assignments using it will keep their record but lose the subject link.`}
        confirmLabel="Delete subject"
      />
    </div>
  );
}
