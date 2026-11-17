import { useMemo, useState } from "react";
import { Activity, Clock, Filter, History, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
  Td,
  Th,
  Timeline,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { listActivityLogs, listRecentHistory } from "../../services";
import { displayName } from "../../types";
import { formatDateTime, formatRelative } from "../../utils/date";

export function AdminActivityPage() {
  const [tab, setTab] = useState("logs");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const debounced = useDebouncedValue(search, 300);

  const { data: logs, loading: logsLoading, error: logsError, reload: reloadLogs } = useAsync(() => listActivityLogs(200), []);
  const { data: history, loading: historyLoading, reload: reloadHistory } = useAsync(() => listRecentHistory(100), []);

  const filteredLogs = useMemo(() => {
    const list = logs ?? [];
    const term = debounced.trim().toLowerCase();
    if (!term) return list.slice(0, limit);
    return list
      .filter((l) => (l.activity ?? "").toLowerCase().includes(term) || (l.actor?.full_name ?? "").toLowerCase().includes(term))
      .slice(0, limit);
  }, [logs, debounced, limit]);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Activity & audit"
        description="A chronological record of key actions performed across iWriter."
        actions={
          <Button
            variant="outline"
            icon={RefreshCcw}
            onClick={() => {
              reloadLogs();
              reloadHistory();
            }}
          >
            Refresh
          </Button>
        }
      />

      <Card flush>
        <div className="iw-tabs" style={{ padding: "0 20px" }}>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "logs", label: "Activity logs", count: logs?.length },
              { value: "history", label: "Assignment history", count: history?.length },
            ]}
          />
        </div>

        {tab === "logs" && (
          <>
            <div className="iw-toolbar">
              <SearchInput
                className="iw-toolbar__grow"
                placeholder="Search activity or user…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="iw-filters">
                {[50, 100, 200].map((value) => (
                  <Chip key={value} active={limit === value} onClick={() => setLimit(value)}>
                    Latest {value}
                  </Chip>
                ))}
              </div>
            </div>

            {logsLoading ? (
              <Loading label="Loading activity…" />
            ) : logsError ? (
              <ErrorState description={logsError} onRetry={reloadLogs} />
            ) : filteredLogs.length === 0 ? (
              <EmptyState icon={Activity} title="No activity recorded" description="Actions performed by users will appear here." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Activity</Th>
                    <Th>IP address</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((entry) => (
                    <tr key={entry.id}>
                      <Td>
                        <div className="iw-inline iw-gap-3">
                          <Avatar name={displayName(entry.actor)} src={entry.actor?.avatar_url} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div className="iw-table__primary truncate" style={{ maxWidth: 180 }}>
                              {entry.actor?.full_name ?? entry.actor?.email ?? "System"}
                            </div>
                            <div className="iw-table__sub">{entry.actor?.role ?? "—"}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-sm">{entry.activity ?? "—"}</span>
                      </Td>
                      <Td>
                        <span className="text-xs mono text-muted">{entry.ip_address ?? "—"}</span>
                      </Td>
                      <Td>
                        <span className="text-sm">{formatRelative(entry.created_at)}</span>
                        <div className="iw-table__sub">{formatDateTime(entry.created_at)}</div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="iw-card__body">
            {historyLoading ? (
              <Loading label="Loading history…" />
            ) : !history || history.length === 0 ? (
              <EmptyState icon={History} title="No assignment history yet" description="Status changes are recorded as assignments move through the pipeline." />
            ) : (
              <Timeline
                items={history.map((entry) => ({
                  icon: ShieldCheck,
                  title: (
                    <span>
                      {entry.assignment?.title ?? "Assignment"} —{" "}
                      <Badge tone="neutral">
                        {entry.old_status ?? "—"} → {entry.new_status ?? "—"}
                      </Badge>
                    </span>
                  ),
                  meta: (
                    <span className="iw-inline iw-gap-2">
                      <span>{entry.actor?.full_name ?? "System"}</span>
                      {entry.remarks && <span className="text-muted">· {entry.remarks}</span>}
                    </span>
                  ),
                  time: entry.created_at,
                }))}
              />
            )}
          </div>
        )}
      </Card>

      <div className="iw-inline iw-gap-3 iw-mt-4 text-xs text-muted">
        <Clock size={13} />
        <span>Activity logs are retained for auditing. {logs?.length ?? 0} entries loaded.</span>
        <Filter size={13} />
        <span>Use search to narrow down.</span>
      </div>
    </div>
  );
}
