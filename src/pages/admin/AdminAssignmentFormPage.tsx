import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Coins,
  Paperclip,
  Save,
  Send,
  Settings2,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Field,
  FieldRow,
  Input,
  Loading,
  PageHeader,
  Select,
  Textarea,
} from "../../components/common";
import { FileUpload, StoredFileList, type StoredFile } from "../../components/forms/FileUpload";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  addAssignmentAttachment,
  createAssignment,
  deleteAssignmentAttachment,
  getAssignment,
  listCategories,
  listSubjects,
  removeFile,
  updateAssignment,
  uploadFiles,
  STORAGE_FOLDERS,
} from "../../services";
import {
  ACADEMIC_LEVELS,
  CITATION_STYLES,
  DURATION_OPTIONS,
  FILE_FORMATS,
  PRIORITY_OPTIONS,
  SPACING_OPTIONS,
  priorityMeta,
} from "../../lib/status";
import { toDateTimeInputValue } from "../../utils/date";
import type { AssignmentStatus, AssignmentPriority } from "../../types/models";

const schema = z.object({
  title: z.string().min(4, "Give the assignment a descriptive title").max(160, "Title is too long"),
  assignment_code: z.string().max(40, "Code is too long").optional(),
  description: z.string().max(4000, "Description is too long").optional(),
  instructions: z.string().max(8000, "Instructions are too long").optional(),
  subject_id: z.string().min(1, "Select a subject"),
  category_id: z.string().min(1, "Select a category"),
  academic_level: z.string().min(1, "Select an academic level"),
  citation_style: z.string().min(1, "Select a citation style"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  visibility: z.enum(["public", "private"]),
  words: z.coerce.number().int().min(0).max(100000).optional(),
  pages: z.coerce.number().int().min(0).max(500).optional(),
  sources_required: z.coerce.number().int().min(0).max(500).optional(),
  spacing: z.string().optional(),
  file_format: z.string().optional(),
  estimated_duration: z.string().optional(),
  max_claims: z.coerce.number().int().min(1, "At least one claim").max(100),
  reward: z.coerce.number().min(0, "Reward cannot be negative").max(1000000),
  deadline: z.string().min(1, "Set a deadline"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  title: "",
  assignment_code: "",
  description: "",
  instructions: "",
  subject_id: "",
  category_id: "",
  academic_level: "",
  citation_style: "",
  priority: "normal",
  visibility: "public",
  words: 1000,
  pages: 4,
  sources_required: 0,
  spacing: "Double",
  file_format: "DOCX",
  estimated_duration: "2 days",
  max_claims: 1,
  reward: 50,
  deadline: "",
};

export function AdminAssignmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<StoredFile[]>([]);
  const [saving, setSaving] = useState<null | AssignmentStatus>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: reference } = useAsync(async () => {
    const [subjects, categories] = await Promise.all([listSubjects(), listCategories()]);
    return { subjects, categories };
  }, []);

  const { data: assignment, loading } = useAsync(async () => {
    if (!id) return null;
    return getAssignment(id);
  }, [id]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (!assignment) return;
    reset({
      title: assignment.title,
      assignment_code: assignment.assignment_code ?? "",
      description: assignment.description ?? "",
      instructions: assignment.instructions ?? "",
      subject_id: assignment.subject_id ?? "",
      category_id: assignment.category_id ?? "",
      academic_level: assignment.academic_level ?? "",
      citation_style: assignment.citation_style ?? "",
      priority: assignment.priority,
      visibility: (assignment.visibility as "public" | "private") ?? "public",
      words: assignment.words ?? 0,
      pages: assignment.pages ?? 0,
      sources_required: assignment.sources_required ?? 0,
      spacing: assignment.spacing ?? "Double",
      file_format: assignment.file_format ?? "DOCX",
      estimated_duration: assignment.estimated_duration ?? "2 days",
      max_claims: assignment.max_claims ?? 1,
      reward: assignment.reward ?? 0,
      deadline: toDateTimeInputValue(assignment.deadline),
    });
    setExistingFiles((assignment.attachments ?? []) as StoredFile[]);
  }, [assignment, reset]);

  const save = async (values: FormValues, status: AssignmentStatus) => {
    if (!user) return;
    setSaving(status);
    setFormError(null);
    try {
      const payload = {
        ...values,
        assignment_code: values.assignment_code?.trim() || null,
        description: values.description || null,
        instructions: values.instructions || null,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
        status,
        visibility: values.visibility,
        priority: values.priority as AssignmentPriority,
      };

      let assignmentId = id;
      if (isEdit && id) {
        await updateAssignment(id, payload);
      } else {
        const created = await createAssignment(payload, user.id);
        assignmentId = created.id;
      }

      if (assignmentId && stagedFiles.length > 0) {
        const uploaded = await uploadFiles(STORAGE_FOLDERS.assignments, assignmentId, stagedFiles);
        for (const file of uploaded) {
          await addAssignmentAttachment({
            assignment_id: assignmentId,
            file_name: file.name,
            file_url: file.path,
          });
        }
      }

      toast.success(
        status === "draft" ? "Draft saved" : isEdit ? "Assignment updated" : "Assignment published",
        status === "draft"
          ? "You can keep editing and publish when ready."
          : "Writers can now see this assignment in the marketplace.",
      );
      navigate("/admin/assignments");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save the assignment.");
    } finally {
      setSaving(null);
    }
  };

  const removeExisting = async (file: StoredFile) => {
    try {
      await deleteAssignmentAttachment(file.id);
      await removeFile(file.file_url ?? "");
      setExistingFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast.success("Attachment removed");
    } catch (err) {
      toast.error("Could not remove attachment", err instanceof Error ? err.message : undefined);
    }
  };

  if (isEdit && loading) return <Loading full label="Loading assignment…" />;

  const submitWithStatus = (status: AssignmentStatus) => handleSubmit((values) => save(values, status))();

  return (
    <div className="animate-fade">
      <PageHeader
        title={isEdit ? "Edit assignment" : "Create assignment"}
        description={
          isEdit
            ? "Update the brief, requirements and compensation for this assignment."
            : "Define a new assignment for writers to claim and complete."
        }
        actions={
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/admin/assignments")}>
            Back
          </Button>
        }
      />

      <form onSubmit={(e) => e.preventDefault()}>
        {formError && (
          <Alert tone="danger" className="iw-mb-5">
            {formError}
          </Alert>
        )}

        <div className="stack iw-gap-5">
          <Card flush>
            <div className="iw-card__body iw-form-section">
              <div className="iw-form-section__head">
                <span className="iw-form-section__icon">
                  <ClipboardList size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="iw-form-section__title">Assignment brief</div>
                  <div className="iw-form-section__desc">What the writer needs to produce.</div>
                </div>
              </div>

              <FieldRow>
                <Field label="Title" htmlFor="title" required error={errors.title?.message}>
                  <Input id="title" placeholder="e.g. Critical analysis of supply chain resilience" {...register("title")} />
                </Field>
                <Field label="Assignment code" htmlFor="assignment_code" hint="Leave blank to auto-generate" error={errors.assignment_code?.message}>
                  <Input id="assignment_code" placeholder="IW-2601-A1B2" {...register("assignment_code")} />
                </Field>
              </FieldRow>

              <Field label="Description" htmlFor="description" error={errors.description?.message}>
                <Textarea id="description" rows={3} placeholder="Summarise the assignment for writers…" {...register("description")} />
              </Field>

              <Field label="Detailed instructions" htmlFor="instructions" error={errors.instructions?.message}>
                <Textarea id="instructions" rows={5} placeholder="Structure, marking criteria, must-include points…" {...register("instructions")} />
              </Field>
            </div>
          </Card>

          <Card flush>
            <div className="iw-card__body iw-form-section">
              <div className="iw-form-section__head">
                <span className="iw-form-section__icon">
                  <BookOpen size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="iw-form-section__title">Classification</div>
                  <div className="iw-form-section__desc">Subject, level and formatting expectations.</div>
                </div>
              </div>

              <FieldRow>
                <Field label="Subject" htmlFor="subject_id" required error={errors.subject_id?.message}>
                  <Select id="subject_id" {...register("subject_id")}>
                    <option value="">Select a subject…</option>
                    {(reference?.subjects ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Category" htmlFor="category_id" required error={errors.category_id?.message}>
                  <Select id="category_id" {...register("category_id")}>
                    <option value="">Select a category…</option>
                    {(reference?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Academic level" htmlFor="academic_level" required error={errors.academic_level?.message}>
                  <Select id="academic_level" {...register("academic_level")}>
                    <option value="">Select a level…</option>
                    {ACADEMIC_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Citation style" htmlFor="citation_style" required error={errors.citation_style?.message}>
                  <Select id="citation_style" {...register("citation_style")}>
                    <option value="">Select a style…</option>
                    {CITATION_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Priority" htmlFor="priority">
                  <Select id="priority" {...register("priority")}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {priorityMeta(p).label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Visibility" htmlFor="visibility" hint="Private assignments are hidden from the marketplace">
                  <Select id="visibility" {...register("visibility")}>
                    <option value="public">Public — open to claims</option>
                    <option value="private">Private — assigned only</option>
                  </Select>
                </Field>
              </FieldRow>
            </div>
          </Card>

          <Card flush>
            <div className="iw-card__body iw-form-section">
              <div className="iw-form-section__head">
                <span className="iw-form-section__icon">
                  <Settings2 size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="iw-form-section__title">Requirements</div>
                  <div className="iw-form-section__desc">Length, sources and delivery format.</div>
                </div>
              </div>

              <FieldRow>
                <Field label="Word count" htmlFor="words" error={errors.words?.message}>
                  <Input id="words" type="number" min={0} {...register("words")} />
                </Field>
                <Field label="Pages" htmlFor="pages" error={errors.pages?.message}>
                  <Input id="pages" type="number" min={0} {...register("pages")} />
                </Field>
                <Field label="Sources required" htmlFor="sources_required" error={errors.sources_required?.message}>
                  <Input id="sources_required" type="number" min={0} {...register("sources_required")} />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Spacing" htmlFor="spacing">
                  <Select id="spacing" {...register("spacing")}>
                    {SPACING_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="File format" htmlFor="file_format">
                  <Select id="file_format" {...register("file_format")}>
                    {FILE_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Estimated duration" htmlFor="estimated_duration">
                  <Select id="estimated_duration" {...register("estimated_duration")}>
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
            </div>
          </Card>

          <Card flush>
            <div className="iw-card__body iw-form-section">
              <div className="iw-form-section__head">
                <span className="iw-form-section__icon">
                  <Coins size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="iw-form-section__title">Compensation & timeline</div>
                  <div className="iw-form-section__desc">How much writers earn and by when.</div>
                </div>
              </div>

              <FieldRow>
                <Field label="Reward (USD)" htmlFor="reward" required error={errors.reward?.message}>
                  <Input id="reward" type="number" min={0} step="0.01" icon={Coins} {...register("reward")} />
                </Field>
                <Field label="Maximum claims" htmlFor="max_claims" required hint="How many writers may work on this" error={errors.max_claims?.message}>
                  <Input id="max_claims" type="number" min={1} {...register("max_claims")} />
                </Field>
                <Field label="Deadline" htmlFor="deadline" required error={errors.deadline?.message}>
                  <Input id="deadline" type="datetime-local" icon={CalendarClock} {...register("deadline")} />
                </Field>
              </FieldRow>
            </div>
          </Card>

          <Card flush>
            <div className="iw-card__body iw-form-section">
              <div className="iw-form-section__head">
                <span className="iw-form-section__icon">
                  <Paperclip size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="iw-form-section__title">Attachments</div>
                  <div className="iw-form-section__desc">Briefs, rubrics or reference material for writers.</div>
                </div>
              </div>

              <FileUpload files={stagedFiles} onChange={setStagedFiles} hint="PDF, DOCX, PPTX, XLSX, ZIP, images — up to 25 MB each" />

              {existingFiles.length > 0 && (
                <div>
                  <div className="iw-field__label iw-mb-4">Already attached</div>
                  <StoredFileList files={existingFiles} onRemove={removeExisting} />
                </div>
              )}
            </div>
          </Card>

          <Card className="iw-sticky-actions">
            <Button
              variant="outline"
              icon={Save}
              loading={saving === "draft"}
              disabled={saving !== null}
              onClick={() => submitWithStatus("draft")}
            >
              Save draft
            </Button>
            <div className="spacer" />
            <Button variant="ghost" onClick={() => navigate("/admin/assignments")} disabled={saving !== null}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Send}
              loading={saving === "available"}
              disabled={saving !== null}
              onClick={() => submitWithStatus("available")}
            >
              {isEdit ? "Save & publish" : "Publish assignment"}
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
