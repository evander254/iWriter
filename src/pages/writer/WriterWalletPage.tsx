import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Banknote,
  Coins,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Money,
  PageHeader,
  Progress,
  Select,
  StatCard,
  Table,
  Td,
  Th,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EarningsAreaChart, CHART_COLORS } from "../../components/dashboard/Charts";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getEarningPoints,
  listRecentTransactions,
  listWithdrawals,
  requestWithdrawal,
  sumTransactions,
} from "../../services";
import { WITHDRAWAL_METHODS } from "../../lib/status";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatRelative } from "../../utils/date";
import { buildTimeSeries, RANGE_OPTIONS, rangeStart, type RangePreset } from "../../utils/charts";
import { Segmented } from "../../components/common";

const MIN_WITHDRAWAL = 10;

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount").min(MIN_WITHDRAWAL, `Minimum is $${MIN_WITHDRAWAL}`),
  method: z.string().min(2, "Choose a payout method"),
  accountNumber: z.string().min(4, "Enter your account or wallet details").max(120),
});
type FormValues = z.infer<typeof schema>;

export function WriterWalletPage() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState<RangePreset>("30d");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [withdrawals, transactions, totals, earnings] = await Promise.all([
      listWithdrawals({ userId: user.id, pageSize: 8 }),
      listRecentTransactions(user.id, 6),
      sumTransactions(user.id),
      getEarningPoints(user.id),
    ]);
    return { withdrawals, transactions, totals, earnings };
  }, [user?.id]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: MIN_WITHDRAWAL, method: WITHDRAWAL_METHODS[0], accountNumber: "" },
  });

  const balance = profile?.available_balance ?? 0;
  const series = useMemo(() => {
    if (!data) return [];
    const start = rangeStart(range);
    return buildTimeSeries(data.earnings.filter((p) => new Date(p.created_at) >= start), range);
  }, [data, range]);

  const rangeTotal = series.reduce((sum, p) => sum + p.value, 0);
  const pendingTotal = (data?.withdrawals.rows ?? [])
    .filter((w) => w.status === "pending" || w.status === "approved")
    .reduce((sum, w) => sum + Number(w.amount ?? 0), 0);

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      await requestWithdrawal({
        amount: values.amount,
        method: values.method,
        accountNumber: values.accountNumber.trim(),
      });
      toast.success("Withdrawal requested", "An administrator will review your request shortly.");
      reset({ amount: MIN_WITHDRAWAL, method: WITHDRAWAL_METHODS[0], accountNumber: "" });
      await refreshProfile();
      reload();
    } catch (err) {
      toast.error("Could not request withdrawal", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading full label="Loading your wallet…" />;
  if (error || !data || !profile) {
    return <ErrorState title="Unable to load wallet" description={error ?? "Please try again."} onRetry={reload} />;
  }

  const suspended = profile.status === "suspended";

  return (
    <div className="animate-fade">
      <PageHeader
        title="My wallet"
        description="Track your earnings and request payouts."
        actions={
          <Segmented
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace("Last ", "") }))}
          />
        }
      />

      <div className="iw-grid iw-grid--stats">
        <StatCard label="Available balance" value={formatCurrency(balance)} icon={WalletIcon} tone="accent" foot="ready to withdraw" />
        <StatCard label="Lifetime earnings" value={formatCurrency(profile.total_earnings)} icon={Coins} tone="success" foot="all time" />
        <StatCard label="Pending payouts" value={formatCurrency(pendingTotal)} icon={PiggyBank} tone="warning" foot="in review" />
        <StatCard label="Total withdrawn" value={formatCurrency(data.totals.debits)} icon={Banknote} tone="accent" foot="paid out" />
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader title="Earnings" subtitle={`${formatCurrency(rangeTotal)} in the selected period`} />
          <div className="iw-chart-card__body">
            {series.every((p) => p.value === 0) ? (
              <EmptyState icon={TrendingUp} title="No earnings in this period" description="Complete assignments to earn." compact />
            ) : (
              <EarningsAreaChart data={series} series={[{ key: "value", name: "Earnings", color: CHART_COLORS.success }]} />
            )}
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Request a withdrawal" subtitle={`Minimum $${MIN_WITHDRAWAL}`} />
          <form className="iw-card__body stack iw-gap-4" onSubmit={handleSubmit(onSubmit)}>
            {suspended && (
              <Alert tone="warning" title="Account suspended">
                You cannot request withdrawals while suspended.
              </Alert>
            )}
            <div className="iw-between iw-p-3" style={{ background: "var(--color-bg-subtle)", borderRadius: 12 }}>
              <span className="text-sm text-secondary">Available</span>
              <strong>{formatCurrency(balance)}</strong>
            </div>
            <Field label="Amount (USD)" htmlFor="amount" required error={errors.amount?.message}>
              <Input id="amount" type="number" step="0.01" min={MIN_WITHDRAWAL} icon={WalletIcon} disabled={suspended} {...register("amount")} />
            </Field>
            <Field label="Payout method" htmlFor="method" required error={errors.method?.message}>
              <Select id="method" disabled={suspended} {...register("method")}>
                {WITHDRAWAL_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Account / wallet details" htmlFor="accountNumber" required error={errors.accountNumber?.message}>
              <Input
                id="accountNumber"
                placeholder="e.g. IBAN, PayPal email, wallet address"
                icon={CreditCard}
                disabled={suspended}
                {...register("accountNumber")}
              />
            </Field>
            <Button type="submit" variant="primary" icon={Banknote} loading={busy} disabled={suspended || balance < MIN_WITHDRAWAL}>
              Request withdrawal
            </Button>
            {balance < MIN_WITHDRAWAL && (
              <p className="text-xs text-muted">You need at least ${MIN_WITHDRAWAL} to request a payout.</p>
            )}
          </form>
        </Card>
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader title="Withdrawal history" subtitle={`${data.withdrawals.count} request(s)`} />
          {data.withdrawals.rows.length === 0 ? (
            <EmptyState icon={Banknote} title="No withdrawals yet" description="Your payout requests will appear here." compact />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th>Requested</Th>
                  <Th>Processed</Th>
                  <Th>Status</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.rows.map((request) => (
                  <tr key={request.id}>
                    <Td>
                      <span className="iw-table__primary">{request.method ?? "—"}</span>
                      <div className="iw-table__sub mono">{request.account_number ?? "—"}</div>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(request.requested_at)}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{request.processed_at ? formatRelative(request.processed_at) : "—"}</span>
                    </Td>
                    <Td>
                      <StatusBadge kind="withdrawal" value={request.status} />
                    </Td>
                    <Td numeric>
                      <Money value={request.amount} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card flush>
          <CardHeader title="Recent transactions" subtitle="Latest wallet activity" />
          {data.transactions.length === 0 ? (
            <EmptyState icon={CreditCard} title="No transactions yet" compact />
          ) : (
            <ul>
              {data.transactions.map((tx) => (
                <li key={tx.id} className="iw-notif" style={{ cursor: "default" }}>
                  <span className="iw-notif__icon">
                    <CreditCard size={16} strokeWidth={2.1} />
                  </span>
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">{tx.description ?? "Transaction"}</div>
                    <div className="iw-notif__text">
                      <Badge tone="neutral">{tx.transaction_type ?? "—"}</Badge> · {formatRelative(tx.created_at)}
                    </div>
                  </div>
                  <Money value={tx.amount} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="iw-mt-5" flush>
        <CardHeader title="Earnings vs. withdrawals" subtitle="How your lifetime earnings have moved" />
        <div className="iw-card__body stack iw-gap-4">
          <div>
            <div className="iw-between iw-mb-2">
              <span className="text-sm text-secondary">Total credited</span>
              <Money value={data.totals.credits} />
            </div>
            <Progress value={100} tone="success" />
          </div>
          <div>
            <div className="iw-between iw-mb-2">
              <span className="text-sm text-secondary">Currently in wallet</span>
              <Money value={balance} />
            </div>
            <Progress value={data.totals.credits ? (balance / data.totals.credits) * 100 : 0} tone="accent" />
          </div>
          <div>
            <div className="iw-between iw-mb-2">
              <span className="text-sm text-secondary">Withdrawn</span>
              <Money value={data.totals.debits} />
            </div>
            <Progress value={data.totals.credits ? (data.totals.debits / data.totals.credits) * 100 : 0} tone="accent" />
          </div>
          <p className="text-xs text-muted">
            {formatNumber(data.totals.credits > 0 ? (data.totals.debits / data.totals.credits) * 100 : 0)}% of your earnings have been withdrawn.
          </p>
        </div>
      </Card>
    </div>
  );
}
