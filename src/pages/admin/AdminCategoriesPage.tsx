import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
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
  Textarea,
  Th,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../../services";
import { supabase } from "../../lib/supabase";
import type { Category } from "../../types/models";
import { formatDate } from "../../utils/date";

const schema = z.object({
  name: z.string().min(2, "Enter a category name").max(80, "Name is too long"),
  description: z.string().max(300, "Description is too long").optional(),
});
type FormValues = z.infer<typeof schema>;

export function AdminCategoriesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, reload } = useAsync(async () => {
    const [categories, assignments] = await Promise.all([
      listCategories(),
      supabase.from("assignments").select("category_id"),
    ]);
    const counts = new Map<string, number>();
    for (const row of assignments.data ?? []) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    return { categories, counts };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "" } });

  const openCreate = () => {
    reset({ name: "", description: "" });
    setCreating(true);
  };
  const openEdit = (category: Category) => {
    reset({ name: category.name, description: category.description ?? "" });
    setEditing(category);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      if (editing) {
        await updateCategory(editing.id, values);
        toast.success("Category updated");
      } else {
        await createCategory(values);
        toast.success("Category created");
      }
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error("Could not save category", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCategory(deleting.id);
      toast.success("Category deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Could not delete category", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const list = data?.categories ?? [];
    if (!debounced.trim()) return list;
    const term = debounced.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term));
  }, [data, debounced]);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Categories"
        description="Group assignments by the type of work required."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New category
          </Button>
        }
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-secondary">{filtered.length} categories</span>
        </div>

        {loading ? (
          <Loading label="Loading categories…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title={search ? "No matching categories" : "No categories yet"}
            description={search ? "Try a different search term." : "Create categories to organise the assignment marketplace."}
            action={
              !search ? (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New category
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th numeric>Assignments</Th>
                <Th>Created</Th>
                <Th className="iw-table__num">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((category) => (
                <tr key={category.id}>
                  <Td>
                    <span className="iw-table__primary">{category.name}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-secondary clamp-2" style={{ maxWidth: 320 }}>
                      {category.description || "—"}
                    </span>
                  </Td>
                  <Td numeric>{data?.counts.get(category.id) ?? 0}</Td>
                  <Td>{formatDate(category.created_at)}</Td>
                  <Td>
                    <div className="iw-table__actions">
                      <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => openEdit(category)} />
                      <IconButton icon={Trash2} label="Delete" size="sm" onClick={() => setDeleting(category)} />
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
        title={editing ? "Edit category" : "New category"}
        description={editing ? "Update this category's details." : "Categories describe the kind of work required."}
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
              {editing ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        <div className="stack iw-gap-4">
          <Field label="Category name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Essay" autoFocus {...register("name")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={3} placeholder="Short description of this category…" {...register("description")} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        tone="danger"
        title="Delete category?"
        description={`"${deleting?.name}" will be removed. Assignments using it will keep their record but lose the category link.`}
        confirmLabel="Delete category"
      />
    </div>
  );
}
