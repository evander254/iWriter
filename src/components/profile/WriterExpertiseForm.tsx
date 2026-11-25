import { useEffect, useMemo, useState } from "react";
import { BookOpen, Save } from "lucide-react";
import { Alert, Button, Card, CardHeader, Chip, EmptyState, Loading } from "../common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { listSubjects, getWriterSubjectIds, saveWriterSubjectIds } from "../../services";

export function WriterExpertiseForm() {
  const { user } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [subjects, selectedIds] = await Promise.all([listSubjects(), getWriterSubjectIds(user.id)]);
    return { subjects, selectedIds };
  }, [user?.id]);

  useEffect(() => {
    if (data) setSelected(data.selectedIds);
  }, [data]);

  const changed = useMemo(() => {
    const initial = new Set(data?.selectedIds ?? []);
    return selected.length !== initial.size || selected.some((id) => !initial.has(id));
  }, [data?.selectedIds, selected]);

  const toggleSubject = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 7) {
        toast.error("Subject limit reached", "Choose up to 7 skills or subjects.");
        return current;
      }
      return [...current, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveWriterSubjectIds(selected);
      toast.success("Expertise updated", "Your marketplace and new assignment alerts now match these subjects.");
      reload();
      window.dispatchEvent(new CustomEvent("iw:realtime"));
    } catch (err) {
      toast.error("Could not save expertise", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card flush>
      <CardHeader icon={BookOpen} title="Skills & subjects" subtitle="Choose the subjects you are confident working in." />
      {loading ? <Loading label="Loading subjects…" /> : error ? (
        <div className="iw-card__body"><Alert tone="danger" title="Could not load subjects">{error}</Alert></div>
      ) : !data || data.subjects.length === 0 ? (
        <div className="iw-card__body"><EmptyState icon={BookOpen} title="No subjects available" description="Subjects will appear here once the platform administrator adds them." compact /></div>
      ) : (
        <div className="iw-card__body stack iw-gap-4">
          <Alert tone="info">
            Select up to 7 subjects. You will only see available assignments and new-assignment alerts for the subjects you select.
          </Alert>
          <p className="text-sm text-secondary">{selected.length} of 7 selected</p>
          <div className="iw-inline iw-gap-2" role="group" aria-label="Your expertise subjects" style={{ flexWrap: "wrap" }}>
            {data.subjects.map((subject) => (
              <Chip key={subject.id} active={selected.includes(subject.id)} disabled={!selected.includes(subject.id) && selected.length >= 7} onClick={() => toggleSubject(subject.id)}>
                {subject.name}
              </Chip>
            ))}
          </div>
          {selected.length === 0 && <p className="text-xs text-warning">No subjects selected. You will not receive assignment matches until you choose your expertise.</p>}
          <div>
            <Button variant="primary" icon={Save} loading={saving} disabled={!changed || saving} onClick={() => void save()}>
              Save expertise
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
