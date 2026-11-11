// Function map (line numbers include this header):
// 1. OverviewPage - line 14: Renders or handles this feature.
// 2. sendReminder - line 64: Renders or handles this feature.
//
import { CalendarDays, Clock3, PawPrint, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { StatCard } from "../components/ui/StatCard";
import { StatusChip } from "../components/ui/StatusChip";
import { supabase } from "../lib/supabase";
import type { Appointment, Pet, VaccineDue } from "../lib/types";

export function OverviewPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [due, setDue] = useState<VaccineDue[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  const [sendingPetId, setSendingPetId] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, reason, status, pets(name, photo_url, owners(full_name)), profiles(full_name)",
        )
        .gte("starts_at", new Date().toISOString())
        .lt("starts_at", new Date(Date.now() + 86400000).toISOString())
        .order("starts_at"),
      supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status, owners(full_name, email)",
        )
        .order("name"),
      supabase
        .from("vaccines_due")
        .select(
          "vaccination_id, pet_id, pet_name, vaccine_name, next_due_on, days_until_due, status",
        )
        .limit(7),
    ]).then(([appointmentResult, petResult, dueResult]) => {
      const failure =
        appointmentResult.error ?? petResult.error ?? dueResult.error;
      if (failure) {
        setError(failure.message);
        setState("error");
        return;
      }
      setAppointments(
        (appointmentResult.data ?? []) as unknown as Appointment[],
      );
      setPets((petResult.data ?? []) as unknown as Pet[]);
      setDue((dueResult.data ?? []) as VaccineDue[]);
      setState("ready");
    });
  }, []);
  const sendReminder = async (petId: string) => {
    if (!supabase) return;
    setSendingPetId(petId);
    setSendMessage("");
    const { error: functionError } = await supabase.functions.invoke(
      "send-reminders",
      { body: { petId } },
    );
    setSendingPetId(null);
    setSendMessage(functionError ? functionError.message : "Reminder sent.");
  };
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(new Date())
    .toUpperCase();
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            âœ¦ {date}
          </p>
          <h1 className="page-title mt-3">Good morning.</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Hereâ€™s whatâ€™s happening at the clinic today.
          </p>
        </div>
        <button
          className="button-primary"
          type="button"
          onClick={() => navigate("/appointments?book=1")}
        >
          <CalendarDays size={16} /> Book appointment
        </button>
      </header>
      {state === "loading" && (
        <p className="panel p-5 text-sm text-text-muted">
          Loading todayâ€™s care scheduleâ€¦
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-border bg-surface-inner p-4 text-sm text-primary-hover"
        >
          {error}
        </p>
      )}
      {state === "ready" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={CalendarDays}
              label="Appointments today"
              value={String(appointments.length)}
              hint="Next 09:00 AM"
            />
            <StatCard
              icon={PawPrint}
              label="Active patients"
              value={String(pets.length)}
              hint="All clinic patients"
            />
            <StatCard
              icon={ShieldCheck}
              label="Vaccines due soon"
              value={String(due.length)}
              hint="Next 14 days"
            />
            <StatCard
              icon={Clock3}
              label="Pending reminders"
              value={String(due.length)}
              hint="Ready to send"
            />
          </section>
          <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg">Todayâ€™s schedule</h2>
                <button
                  className="text-xs text-primary"
                  type="button"
                  onClick={() => navigate("/appointments")}
                >
                  View calendar â†’
                </button>
              </div>
              {appointments.length === 0 ? (
                <p className="mt-8 rounded-xl bg-surface-inner p-5 text-sm text-text-muted">
                  No appointments scheduled today.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="w-14 text-xs font-medium">
                        {new Date(appointment.starts_at).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </div>
                      <Avatar
                        name={appointment.pets.name}
                        src={appointment.pets.photo_url}
                        className="h-10 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {appointment.pets.name}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {appointment.reason} Â·{" "}
                          {appointment.pets.owners?.full_name ?? "Owner"}
                        </p>
                      </div>
                      <StatusChip label={appointment.status} />
                      <span className="hidden text-xs text-text-muted sm:block">
                        {appointment.profiles?.full_name ?? "Vet"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg">Reminders</h2>
                <button
                  className="text-xs text-primary"
                  type="button"
                  onClick={() => navigate("/vaccinations")}
                >
                  Manage â†’
                </button>
              </div>
              {sendMessage && (
                <p role="status" className="mt-3 text-xs text-primary-hover">
                  {sendMessage}
                </p>
              )}
              {due.length === 0 ? (
                <p className="mt-8 text-sm text-text-muted">
                  No reminders are due soon.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {due.slice(0, 3).map((item) => (
                    <div
                      key={item.vaccination_id}
                      className="rounded-xl border border-border bg-surface-inner p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {item.vaccine_name}
                        </p>
                        <StatusChip
                          label={
                            item.status === "overdue"
                              ? "Overdue"
                              : `Due in ${item.days_until_due} days`
                          }
                          tone="rose"
                        />
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {item.pet_name} Â· {item.next_due_on}
                      </p>
                      <button
                        className="mt-3 w-full rounded-lg border border-border bg-white/40 py-2 text-xs disabled:opacity-50"
                        type="button"
                        disabled={sendingPetId === item.pet_id}
                        onClick={() => void sendReminder(item.pet_id)}
                      >
                        {sendingPetId === item.pet_id
                          ? "Sendingâ€¦"
                          : "Send reminder"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="font-heading text-lg">Recently viewed patients</h2>
            {pets.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No patients found.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pets.slice(0, 4).map((pet) => (
                  <Link
                    to={`/pets/${pet.id}`}
                    key={pet.id}
                    className="flex items-center gap-3 rounded-xl bg-surface-inner p-3 transition-colors hover:bg-status-rose"
                  >
                    <Avatar
                      name={pet.name}
                      src={pet.photo_url}
                      className="h-10 w-10"
                    />
                    <div>
                      <p className="text-sm font-medium">{pet.name}</p>
                      <p className="text-xs text-text-muted">
                        {pet.breed ?? pet.species}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
