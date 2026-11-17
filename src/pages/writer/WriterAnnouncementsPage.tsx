import { Megaphone, RefreshCcw } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Loading, PageHeader } from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { listAnnouncements } from "../../services";
import { formatDateTime, formatRelative } from "../../utils/date";

export function WriterAnnouncementsPage() {
  const { data, loading, error, reload } = useAsync(() => listAnnouncements(true), []);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Announcements"
        description="News and updates from the iWriter team."
        actions={
          <Button variant="ghost" icon={RefreshCcw} onClick={reload}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Loading label="Loading announcements…" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements right now"
            description="Check back later for platform updates and news."
          />
        </Card>
      ) : (
        <div className="stack iw-gap-4">
          {data.map((item) => (
            <Card key={item.id} flush>
              <div className="iw-card__body">
                <div className="iw-inline iw-gap-3">
                  <span className="iw-form-section__icon">
                    <Megaphone size={16} strokeWidth={2.2} />
                  </span>
                  <h2 style={{ fontSize: 17, fontWeight: 650 }}>{item.title ?? "Announcement"}</h2>
                </div>
                <p className="text-sm text-secondary iw-mt-4" style={{ whiteSpace: "pre-wrap" }}>
                  {item.message ?? ""}
                </p>
                <div className="text-xs text-muted iw-mt-4">
                  {formatDateTime(item.created_at)} · {formatRelative(item.created_at)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
