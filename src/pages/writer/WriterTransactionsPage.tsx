import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, CreditCard, RefreshCcw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Money,
  PageHeader,
  Pagination,
  StatCard,
  Table,
  Td,
  Th,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { listTransactions, sumTransactions } from "../../services";
import { formatCurrency } from "../../utils/format";
import { formatDateTime, formatRelative } from "../../utils/date";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "earning", label: "Earnings" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "bonus", label: "Bonuses" },
  { value: "penalty", label: "Penalties" },
  { value: "adjustment", label: "Adjustments" },
];

export function WriterTransactionsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");

  const { data, loading, error, reload } = useAsync(
    () =>
      user
        ? listTransactions({ userId: user.id, page, pageSize: 15, type: type === "all" ? undefined : type })
        : Promise.resolve(null),
    [user?.id, page, type],
  );

  const { data: totals } = useAsync(async () => (user ? sumTransactions(user.id) : null), [user?.id]);

  return (
    <div className="animate-fade">
      <PageHeader
        title="Transactions"
        description="A complete ledger of every credit and debit on your wallet."
        actions={
          <Button variant="ghost" icon={RefreshCcw} onClick={reload}>
            Refresh
          </Button>
        }
      />

      <div className="iw-grid iw-grid--stats iw-mb-5">
        <StatCard label="Total credited" value={formatCurrency(totals?.credits)} icon={ArrowUpRight} tone="success" foot="earnings, bonuses" />
        <StatCard label="Total debited" value={formatCurrency(totals?.debits)} icon={ArrowDownRight} tone="danger" foot="withdrawals, penalties" />
        <StatCard label="Net" value={formatCurrency((totals?.credits ?? 0) - (totals?.debits ?? 0))} icon={Coins} tone="accent" foot="lifetime" />
        <StatCard label="Entries" value={data?.count ?? 0} icon={CreditCard} tone="info" foot="records" />
      </div>

      <Card flush>
        <div className="iw-toolbar">
          <div className="iw-filters">
            {TYPE_TABS.map((tab) => (
              <Chip
                key={tab.value}
                active={type === tab.value}
                onClick={() => {
                  setType(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <Loading label="Loading transactions…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No transactions found" description="Your wallet activity will appear here." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th>Reference</Th>
                  <Th>Date</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((tx) => (
                  <tr key={tx.id}>
                    <Td>
                      <span className="iw-table__primary">{tx.description ?? "Transaction"}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{tx.transaction_type ?? "—"}</Badge>
                    </Td>
                    <Td>
                      <span className="text-xs mono text-muted">{tx.reference ? tx.reference.slice(0, 14) : "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(tx.created_at)}</span>
                      <div className="iw-table__sub">{formatDateTime(tx.created_at)}</div>
                    </Td>
                    <Td numeric>
                      <Money value={tx.amount} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data.pageSize} total={data.count} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
