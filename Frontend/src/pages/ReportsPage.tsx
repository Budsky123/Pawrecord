// Function map (line numbers include this header):
// 1. ReportsPage - line 10: Renders or handles this feature.
//
import { BarChart3, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type MonthlyVisit = { label: string; value: number };

export function ReportsPage() {
  const [stats, setStats] = useState({
    visits: 0,
    appointments: 0,
    completed: 0,
    reminders: 0,
    sent: 0,
  });
  const [monthlyVisits, setMonthlyVisits] = useState<MonthlyVisit[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase
        .from("visits")
        .select("id, visit_date", { count: "exact" })
        .is("deleted_at", null),
      supabase.from("appointments").select("id, status"),
      supabase.from("reminders").select("id, status"),
    ]).then(([visits, appointments, reminders]) => {
      const failure = visits.error ?? appointments.error ?? reminders.error;
      if (failure) {
        setError(failure.message);
        setState("error");
        return;
      }
      const appointmentRows = appointments.data ?? [];
      const reminderRows = reminders.data ?? [];
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - (5 - index));
        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          label: date.toLocaleDateString([], { month: "short" }),
          value: 0,
        };
      });
      for (const visit of visits.data ?? []) {
        const date = new Date(visit.visit_date);
        const month = months.find(
          (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`,
        );
        if (month) month.value += 1;
      }
      setMonthlyVisits(months.map(({ label, value }) => ({ label, value })));
      setStats({
        visits: visits.count ?? 0,
        appointments: appointmentRows.length,
        completed: appointmentRows.filter((item) => item.status === "completed")
          .length,
        reminders: reminderRows.length,
        sent: reminderRows.filter((item) => item.status === "sent").length,
      });
      setState("ready");
    });
  }, []);
  if (state === "loading")
    return (
      <p className="panel p-5 text-sm text-text-muted">Loading reportsâ€¦</p>
    );
  if (state === "error")
    return (
      <p role="alert" className="panel p-5 text-sm text-primary-hover">
        {error}
      </p>
    );
  const completion = stats.appointments
    ? Math.round((stats.completed / stats.appointments) * 100)
    : 0;
  const response = stats.reminders
    ? Math.round((stats.sent / stats.reminders) * 100)
    : 0;
  const max = Math.max(...monthlyVisits.map((month) => month.value), 1);
  return (
    <div className="space-y-7" data-no-print="false">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Clinic insights
          </p>
          <h1 className="page-title mt-3">Reports</h1>
          <p className="mt-2 text-sm text-text-muted">
            A simple view of care activity and client follow-up.
          </p>
        </div>
        <button
          className="button-primary"
          type="button"
          onClick={() => window.print()}
        >
          <Printer size={16} /> Export report
        </button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="panel p-5">
          <p className="text-xs text-text-muted">Total visits</p>
          <p className="mt-2 font-heading text-3xl">{stats.visits}</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs text-text-muted">Appointment completion</p>
          <p className="mt-2 font-heading text-3xl">{completion}%</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs text-text-muted">Reminder response</p>
          <p className="mt-2 font-heading text-3xl">{response}%</p>
        </article>
      </section>
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg">
          <BarChart3 size={18} className="text-primary" /> Visits over time
        </h2>
        {stats.visits === 0 ? (
          <p className="mt-8 rounded-xl bg-surface-inner p-5 text-sm text-text-muted">
            No visits have been recorded yet.
          </p>
        ) : (
          <div className="mt-6 flex h-48 items-end gap-3">
            {monthlyVisits.map((month) => (
              <div
                key={month.label}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-t-lg bg-primary/80 transition-all"
                  style={{
                    height: `${(month.value / max) * 100}%`,
                    minHeight: month.value > 0 ? "4px" : "0",
                  }}
                  title={`${month.value} visits`}
                />
                <span className="text-[10px] text-text-muted">
                  {month.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
