import { useEffect, useState } from "react";
import { Award, BookOpen, CalendarDays, CheckCircle2, Edit3, Eye, FileClock, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, ErrorState, Loading, PageHeader, StatCard } from "../../components/common";
import { ProfileForm } from "../../components/profile/ProfileForm";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { countWriterClaimsByStatus, getWriterSubjectIds, listRevisionRequestsForWriter, listSubjects } from "../../services";
import { displayName } from "../../types";
import { formatDate } from "../../utils/date";
import { getSignedUrl } from "../../services";

export function WriterProfilePage() {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [subjectIds, subjects, claims, revisions] = await Promise.all([
      getWriterSubjectIds(user.id),
      listSubjects(),
      countWriterClaimsByStatus(user.id),
      listRevisionRequestsForWriter(user.id),
    ]);
    return { subjectIds, subjects, claims, revisions };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const avatar = profile?.avatar_url;
    if (!avatar) {
      setAvatarSrc(null);
      return;
    }
    if (avatar.startsWith("data:") || avatar.startsWith("/avatars/")) {
      setAvatarSrc(avatar);
      return;
    }
    void getSignedUrl(avatar).then((url) => { if (!cancelled) setAvatarSrc(url); });
    return () => { cancelled = true; };
  }, [profile?.avatar_url]);

  if (!profile) return <Loading full label="Loading profile…" />;

  const activeAssignments = (data?.claims.claimed ?? 0) + (data?.claims.submitted ?? 0) + (data?.claims.revision ?? 0);
  const completedAssignments = (data?.claims.approved ?? 0);
  const pendingRevisions = data?.revisions.filter((revision) => revision.status === "pending").length ?? 0;
  const expertise = data?.subjects.filter((subject) => data.subjectIds.includes(subject.id)) ?? [];

  return (
    <div className="animate-fade">
      <PageHeader
        title="My profile"
        description={editing ? "Update your profile information, expertise and profile photo." : "Your professional profile, visible to the iWriter team."}
        actions={
          <Button variant={editing ? "ghost" : "primary"} icon={editing ? Eye : Edit3} onClick={() => setEditing((current) => !current)}>
            {editing ? "View profile" : "Edit profile"}
          </Button>
        }
      />

      {editing ? (
        <div className="stack iw-gap-5">
          <Alert tone="info" title="Edit by section">
            Save personal details, expertise and your profile photo independently. Your selected subjects control which assignments and new-work alerts you receive.
          </Alert>
          <ProfileForm />
        </div>
      ) : (
        <div className="stack iw-gap-5">
          <Card flush>
            <div className="iw-card__body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 24 }}>
              <Avatar name={displayName(profile)} src={avatarSrc} size="xl" />
              <div className="stack iw-gap-3" style={{ minWidth: 0 }}>
                <div className="iw-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>{displayName(profile)}</h2>
                    <p className="text-sm text-secondary" style={{ margin: "4px 0 0" }}>Writer · Member since {formatDate(profile.created_at)}</p>
                  </div>
                  <Badge tone={profile.status === "active" ? "success" : profile.status === "suspended" ? "danger" : "neutral"} dot>
                    {profile.status}
                  </Badge>
                </div>
                {profile.bio ? (
                  <p className="text-sm" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{profile.bio}</p>
                ) : (
                  <p className="text-sm text-muted" style={{ margin: 0 }}>Add a short professional bio to introduce yourself to the team.</p>
                )}
                {profile.country && <span className="iw-inline iw-gap-2 text-sm text-secondary"><MapPin size={15} />{profile.country}</span>}
              </div>
            </div>
          </Card>

          <div className="iw-grid iw-grid--stats">
            <StatCard label="Completed assignments" value={completedAssignments} icon={CheckCircle2} tone="success" foot="approved work" />
            <StatCard label="Active assignments" value={activeAssignments} icon={Award} tone="accent" foot="in progress or review" />
            <StatCard label="Revisions" value={pendingRevisions} icon={FileClock} tone="warning" foot="awaiting your update" />
          </div>

          <div className="iw-grid iw-grid--2-1">
            <Card flush>
              <CardHeader icon={BookOpen} title="Skills & subjects" subtitle="The areas you are available to work in." />
              <div className="iw-card__body">
                {loading ? <Loading label="Loading expertise…" /> : error ? (
                  <ErrorState description={error} onRetry={reload} />
                ) : expertise.length > 0 ? (
                  <div className="iw-inline iw-gap-2" style={{ flexWrap: "wrap" }}>
                    {expertise.map((subject) => <Badge key={subject.id} tone="accent">{subject.name}</Badge>)}
                  </div>
                ) : (
                  <EmptyState icon={BookOpen} title="No expertise selected" description="Choose your subjects to match with relevant work." compact action={<Button variant="outline" icon={Edit3} onClick={() => setEditing(true)}>Add subjects</Button>} />
                )}
              </div>
            </Card>

            <Card flush>
              <CardHeader icon={UserRound} title="Contact & account" subtitle="Your saved profile details." />
              <div className="iw-card__body">
                <DescriptionList
                  items={[
                    { label: "Email", value: <span className="iw-inline iw-gap-2"><Mail size={14} />{profile.email ?? "Not provided"}</span> },
                    { label: "Phone", value: <span className="iw-inline iw-gap-2"><Phone size={14} />{profile.phone ?? "Not provided"}</span> },
                    { label: "Country", value: <span className="iw-inline iw-gap-2"><MapPin size={14} />{profile.country ?? "Not provided"}</span> },
                    { label: "Member since", value: <span className="iw-inline iw-gap-2"><CalendarDays size={14} />{formatDate(profile.created_at)}</span> },
                  ]}
                />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
