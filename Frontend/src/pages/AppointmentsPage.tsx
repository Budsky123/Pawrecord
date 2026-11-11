// Function map (line numbers include this header):
// 1. dateKey - line 49: Creates a comparable appointment date key.
// 2. statusTone - line 53: Maps an appointment status to a visual tone.
// 3. AppointmentsPage - line 63: Renders or handles this feature.
// 4. toggleBookingForm - line 85: Shows or hides the booking form.
// 5. updateForm - line 150: Updates booking form state.
// 6. submit - line 153: Renders or handles this feature.
// 7. cancel - line 183: Renders or handles this feature.
// 8. updateStatus - line 193: Renders or handles this feature.
// 9. openReschedule - line 207: Loads an appointment into the reschedule form.
// 10. submitReschedule - line 219: Renders or handles this feature.
//
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/ui/Avatar";
import { StatusChip } from "../components/ui/StatusChip";
import { supabase } from "../lib/supabase";
import type { Appointment, Pet, Profile } from "../lib/types";
import { useSearchParams } from "react-router-dom";

type BookingForm = {
  petId: string;
  vetId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
};
const today = new Date();
const dateInput = today.toISOString().slice(0, 10);
const emptyForm: BookingForm = {
  petId: "",
  vetId: "",
  date: dateInput,
  start: "09:00",
  end: "09:30",
  reason: "",
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusTone(status: Appointment["status"]) {
  return status === "cancelled" ||
    status === "no_show" ||
    status === "rescheduled"
    ? "rose"
    : status === "pending"
      ? "scheduled"
      : "neutral";
}

export function AppointmentsPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [vets, setVets] = useState<Profile[]>([]);
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [selectedDate, setSelectedDate] = useState(dateInput);
  const [showForm, setShowForm] = useState(
    () => searchParams.get("book") === "1",
  );
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const canManageStatus = profile?.role === "staff" || profile?.role === "vet";
  const toggleBookingForm = () => {
    setShowForm((current) => !current);
    if (showForm) {
      searchParams.delete("book");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const load = useCallback(async () => {
    if (!supabase) return;
    const appointmentResult = await supabase
      .from("appointments")
      .select(
        "id, pet_id, vet_id, starts_at, ends_at, reason, status, pets(name, photo_url, owners(full_name)), profiles(full_name)",
      )
      .order("starts_at");
    const petResult = await supabase
      .from("pets")
      .select(
        "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status",
      )
      .order("name");
    const vetResult =
      profile?.role === "owner"
        ? await supabase.rpc("list_veterinarians")
        : await supabase
            .from("profiles")
            .select("id, full_name, role, phone")
            .eq("role", "vet")
            .order("full_name");
    const failure =
      appointmentResult.error ?? petResult.error ?? vetResult.error;
    if (failure) {
      setError(failure.message);
      setState("error");
      return;
    }
    setAppointments((appointmentResult.data ?? []) as unknown as Appointment[]);
    setPets((petResult.data ?? []) as Pet[]);
    setVets((vetResult.data ?? []) as Profile[]);
    setState("ready");
  }, [profile?.role]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const firstDay = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  );
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const visible = appointments.filter(
    (appointment) => appointment.starts_at.slice(0, 10) === selectedDate,
  );
  const canCreate =
    profile?.role === "staff" ||
    profile?.role === "vet" ||
    profile?.role === "owner";
  const updateForm = (changes: Partial<BookingForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !profile) return;
    setSaving(true);
    setError("");
    const startsAt = new Date(`${form.date}T${form.start}`).toISOString();
    const endsAt = new Date(`${form.date}T${form.end}`).toISOString();
    const result = await supabase.from("appointments").insert({
      pet_id: form.petId,
      vet_id: form.vetId,
      starts_at: startsAt,
      ends_at: endsAt,
      reason: form.reason,
      status: profile.role === "owner" ? "pending" : "confirmed",
    });
    if (result.error) {
      setError(
        result.error.code === "23P01"
          ? "That vet already has an appointment during this time. Choose another slot."
          : result.error.message,
      );
    } else {
      setForm(emptyForm);
      setSelectedDate(form.date);
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  const cancel = async (appointment: Appointment) => {
    if (!supabase) return;
    setError("");
    const result = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id);
    if (result.error) setError(result.error.message);
    else await load();
  };
  const updateStatus = async (
    appointment: Appointment,
    status: "confirmed" | "completed" | "no_show" | "cancelled",
  ) => {
    if (!supabase) return;
    setOpenMenu(null);
    setError("");
    const result = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointment.id);
    if (result.error) setError(result.error.message);
    else await load();
  };
  const openReschedule = (appointment: Appointment) => {
    setOpenMenu(null);
    setForm({
      petId: appointment.pet_id,
      vetId: appointment.vet_id,
      date: appointment.starts_at.slice(0, 10),
      start: new Date(appointment.starts_at).toTimeString().slice(0, 5),
      end: new Date(appointment.ends_at).toTimeString().slice(0, 5),
      reason: appointment.reason,
    });
    setRescheduling(appointment);
  };
  const submitReschedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !rescheduling) return;
    setSaving(true);
    setError("");
    const startsAt = new Date(`${form.date}T${form.start}`).toISOString();
    const endsAt = new Date(`${form.date}T${form.end}`).toISOString();
    const result = await supabase.from("appointments").insert({
      pet_id: form.petId,
      vet_id: form.vetId,
      starts_at: startsAt,
      ends_at: endsAt,
      reason: form.reason,
      status: "confirmed",
    });
    if (result.error)
      setError(
        result.error.code === "23P01"
          ? "That vet already has an appointment during this time."
          : result.error.message,
      );
    else {
      const oldResult = await supabase
        .from("appointments")
        .update({ status: "rescheduled" })
        .eq("id", rescheduling.id);
      if (oldResult.error) setError(oldResult.error.message);
      else {
        setRescheduling(null);
        setForm(emptyForm);
        setSelectedDate(form.date);
        await load();
      }
    }
    setSaving(false);
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Schedule
          </p>
          <h1 className="page-title mt-3">Appointments</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">
            Coordinate visits and keep the clinic on schedule.
          </p>
        </div>
        {canCreate && (
          <button
            className="button-primary"
            type="button"
            onClick={toggleBookingForm}
          >
            <CalendarPlus size={16} /> New appointment
          </button>
        )}
      </header>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCalendarMonth(
                new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth() - 1,
                  1,
                ),
              )
            }
            className="rounded-lg p-2 text-text-muted hover:bg-status-rose hover:text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <h2 className="font-heading text-lg">
              {calendarMonth.toLocaleDateString([], {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => {
                const now = new Date();
                setCalendarMonth(
                  new Date(now.getFullYear(), now.getMonth(), 1),
                );
                setSelectedDate(dateKey(now));
              }}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCalendarMonth(
                new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth() + 1,
                  1,
                ),
              )
            }
            className="rounded-lg p-2 text-text-muted hover:bg-status-rose hover:text-primary"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-text-muted"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((date) => {
            const key = dateKey(date);
            const count = appointments.filter(
              (appointment) => appointment.starts_at.slice(0, 10) === key,
            ).length;
            const inMonth = date.getMonth() === calendarMonth.getMonth();
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`min-h-20 border-b border-r border-border p-2 text-left transition-colors hover:bg-status-rose ${selectedDate === key ? "bg-status-rose" : ""} ${inMonth ? "text-text-primary" : "text-text-muted/50"}`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${key === dateKey(today) ? "bg-primary font-medium text-white" : ""}`}
                >
                  {date.getDate()}
                </span>
                {count > 0 && (
                  <span className="mt-2 block text-[10px] text-primary">
                    {count} appointment{count === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {(showForm || rescheduling) && (
        <form
          onSubmit={rescheduling ? submitReschedule : submit}
          className="panel grid gap-4 p-5 md:grid-cols-3"
        >
          <h2 className="font-heading text-lg md:col-span-3">
            {rescheduling ? "Reschedule appointment" : "Book an appointment"}
          </h2>
          <label className="text-sm">
            Patient
            <select
              className="field mt-2"
              required
              disabled={Boolean(rescheduling)}
              value={form.petId}
              onChange={(event) => updateForm({ petId: event.target.value })}
            >
              <option value="">Select a patient</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Vet
            <select
              className="field mt-2"
              required
              value={form.vetId}
              onChange={(event) => updateForm({ vetId: event.target.value })}
            >
              <option value="">Select a vet</option>
              {vets.map((vet) => (
                <option key={vet.id} value={vet.id}>
                  {vet.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Reason
            <input
              className="field mt-2"
              required
              value={form.reason}
              onChange={(event) => updateForm({ reason: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Date
            <input
              className="field mt-2"
              type="date"
              required
              min={dateInput}
              value={form.date}
              onChange={(event) => updateForm({ date: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Starts
            <input
              className="field mt-2"
              type="time"
              required
              value={form.start}
              onChange={(event) => updateForm({ start: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Ends
            <input
              className="field mt-2"
              type="time"
              required
              value={form.end}
              onChange={(event) => updateForm({ end: event.target.value })}
            />
          </label>
          {error && (
            <p
              role="alert"
              className="text-sm text-primary-hover md:col-span-3"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2 md:col-span-3">
            <button className="button-primary" type="submit" disabled={saving}>
              {saving
                ? "Savingâ€¦"
                : rescheduling
                  ? "Confirm reschedule"
                  : "Save appointment"}
            </button>
            <button
              className="rounded-xl border border-border px-4 text-sm"
              type="button"
              onClick={() => {
                setShowForm(false);
                setRescheduling(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state === "loading" && (
        <p className="panel p-5 text-sm text-text-muted">
          Loading appointmentsâ€¦
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="panel p-5 text-sm text-primary-hover">
          {error}
        </p>
      )}
      {state === "ready" && (
        <section className="panel overflow-visible">
          <div className="border-b border-border p-5">
            <h2 className="font-heading text-lg">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            <p className="text-xs text-text-muted">
              {visible.length} scheduled visit{visible.length === 1 ? "" : "s"}
            </p>
          </div>
          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              No appointments scheduled for this day.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((appointment) => (
                <article
                  key={appointment.id}
                  className={`relative flex flex-wrap items-center gap-3 p-4 ${openMenu === appointment.id ? "z-20" : ""}`}
                >
                  <div className="flex w-20 items-center gap-2 text-xs font-medium">
                    <Clock3 size={14} className="text-primary" />
                    {new Date(appointment.starts_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <Avatar
                    name={appointment.pets.name}
                    src={appointment.pets.photo_url}
                    className="h-10 w-10"
                  />
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-medium">
                      {appointment.pets.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {appointment.reason} Â·{" "}
                      {appointment.pets.owners?.full_name ?? "Owner"}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">
                    {appointment.profiles?.full_name ?? "Vet"}
                  </p>
                  <StatusChip
                    label={appointment.status}
                    tone={statusTone(appointment.status)}
                  />
                  {canManageStatus && (
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Appointment actions for ${appointment.pets.name}`}
                        onClick={() =>
                          setOpenMenu(
                            openMenu === appointment.id ? null : appointment.id,
                          )
                        }
                        className="rounded-lg p-2 text-text-muted hover:bg-surface-inner hover:text-primary"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {openMenu === appointment.id && (
                        <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-border bg-surface-inner p-1 text-xs shadow-primary">
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-status-rose"
                            onClick={() =>
                              void updateStatus(appointment, "confirmed")
                            }
                          >
                            Confirm appointment
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-status-rose"
                            onClick={() =>
                              void updateStatus(appointment, "completed")
                            }
                          >
                            Completed / showed up
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-status-rose"
                            onClick={() =>
                              void updateStatus(appointment, "no_show")
                            }
                          >
                            Missed appointment
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-status-rose"
                            onClick={() => openReschedule(appointment)}
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-primary-hover hover:bg-status-rose"
                            onClick={() =>
                              void updateStatus(appointment, "cancelled")
                            }
                          >
                            Cancel appointment
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!canManageStatus &&
                    appointment.status !== "cancelled" &&
                    appointment.status !== "completed" && (
                      <button
                        type="button"
                        aria-label={`Cancel ${appointment.pets.name} appointment`}
                        onClick={() => void cancel(appointment)}
                        className="rounded-lg p-2 text-text-muted hover:bg-surface-inner hover:text-primary"
                      >
                        <X size={15} />
                      </button>
                    )}
                  {appointment.status === "confirmed" && (
                    <Check size={15} className="text-status-scheduled" />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
