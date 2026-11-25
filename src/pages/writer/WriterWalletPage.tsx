import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Banknote,
  CalendarDays,
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
  getWriterWithdrawalMethod,
  saveWriterWithdrawalMethod,
  sumTransactions,
} from "../../services";
import { WITHDRAWAL_METHODS } from "../../lib/status";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatRelative } from "../../utils/date";
import { buildTimeSeries, RANGE_OPTIONS, rangeStart, type RangePreset } from "../../utils/charts";
import { Segmented } from "../../components/common";

const MIN_WITHDRAWAL = 5;

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount").min(MIN_WITHDRAWAL, `Minimum is $${MIN_WITHDRAWAL}`),
});
type FormValues = z.infer<typeof schema>;

function nextWithdrawalDate(now = new Date()): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDate();
  if (day === 1 || day === 15) return date;
  if (day < 15) date.setUTCDate(15);
  else date.setUTCMonth(date.getUTCMonth() + 1, 1);
  return date;
}

function changedThisMonth(value?: string): boolean {
  if (!value) return false;
  const changed = new Date(value);
  const now = new Date();
  return changed.getUTCFullYear() === now.getUTCFullYear() && changed.getUTCMonth() === now.getUTCMonth();
}

export function WriterWalletPage() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState<RangePreset>("30d");
  const [busy, setBusy] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<string>(WITHDRAWAL_METHODS[0]);
  const [payoutAccount, setPayoutAccount] = useState("");

  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [withdrawals, transactions, totals, earnings, withdrawalMethod] = await Promise.all([
      listWithdrawals({ userId: user.id, pageSize: 8 }),
      listRecentTransactions(user.id, 6),
      sumTransactions(user.id),
      getEarningPoints(user.id),
      getWriterWithdrawalMethod(user.id),
    ]);
    return { withdrawals, transactions, totals, earnings, withdrawalMethod };
  }, [user?.id]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: MIN_WITHDRAWAL },
  });

  useEffect(() => {
    if (!data?.withdrawalMethod) return;
    setPayoutMethod(data.withdrawalMethod.method);
    setPayoutAccount(data.withdrawalMethod.account_number);
  }, [data?.withdrawalMethod]);

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
      await requestWithdrawal(values.amount);
      toast.success("Withdrawal requested", "An administrator will review your request shortly.");
      reset({ amount: MIN_WITHDRAWAL });
      await refreshProfile();
      reload();
    } catch (err) {
      toast.error("Could not request withdrawal", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const onSavePayoutMethod = async () => {
    if (!payoutMethod || payoutAccount.trim().length < 4) {
      toast.error("Enter valid payout details", "Account or wallet details must be at least 4 characters.");
      return;
    }
    setBusy(true);
    try {
      await saveWriterWithdrawalMethod(payoutMethod, payoutAccount.trim());
      toast.success("Default withdrawal method saved", "You can change it once per calendar month.");
      reload();
    } catch (err) {
      toast.error("Could not save withdrawal method", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading full label="Loading your wallet…" />;
  if (error || !data || !profile) {
    return <ErrorState title="Unable to load wallet" description={error ?? "Please try again."} onRetry={reload} />;
  }

  const suspended = profile.status === "suspended";
  const withdrawalDay = [1, 15].includes(new Date().getUTCDate());
  const canEditPayoutMethod = !data.withdrawalMethod || !changedThisMonth(data.withdrawalMethod.last_changed_at);
  const nextPayoutDate = nextWithdrawalDate().toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" });

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

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader icon={CalendarDays} title="Default withdrawal method" subtitle="Set your payout details before requesting a withdrawal." />
            <div className="iw-card__body stack iw-gap-4">
              {data.withdrawalMethod && !canEditPayoutMethod && (
                <Alert tone="info" title="Monthly change limit reached">
                  Your default method can be changed again next month. You can still request a payout using the saved details below.
                </Alert>
              )}
              <Field label="Payout method" htmlFor="payoutMethod" required>
                <Select id="payoutMethod" value={payoutMethod} disabled={suspended || busy || !canEditPayoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                  {WITHDRAWAL_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </Select>
              </Field>
              <Field label="Account / wallet details" htmlFor="payoutAccount" required hint="These details will be used for every withdrawal request until changed.">
                <Input
                  id="payoutAccount"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  placeholder="e.g. IBAN, PayPal email, wallet address"
                  icon={CreditCard}
                  disabled={suspended || busy || !canEditPayoutMethod}
                />
              </Field>
              {canEditPayoutMethod && (
                <Button variant="outline" loading={busy} disabled={suspended} onClick={() => void onSavePayoutMethod()}>
                  {data.withdrawalMethod ? "Update default method" : "Save default method"}
                </Button>
              )}
            </div>
          </Card>

          <Card flush>
          <CardHeader title="Request a withdrawal" subtitle={`Minimum $${MIN_WITHDRAWAL} · Withdrawals on the 1st and 15th`} />
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
            {data.withdrawalMethod && (
              <p className="text-xs text-muted">Paying to {data.withdrawalMethod.method} · {data.withdrawalMethod.account_number}</p>
            )}
            {!withdrawalDay && (
              <Alert tone="info" title="Withdrawal dates are the 1st and 15th">
                Your next withdrawal date is {nextPayoutDate} (UTC).
              </Alert>
            )}
            <Button type="submit" variant="primary" icon={Banknote} loading={busy} disabled={suspended || balance < MIN_WITHDRAWAL || !data.withdrawalMethod || !withdrawalDay}>
              Request withdrawal
            </Button>
            {!data.withdrawalMethod && <p className="text-xs text-muted">Save a default withdrawal method above before requesting a payout.</p>}
            {balance < MIN_WITHDRAWAL && (
              <p className="text-xs text-muted">You need at least ${MIN_WITHDRAWAL} to request a payout.</p>
            )}
          </form>
          </Card>
        </div>
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
