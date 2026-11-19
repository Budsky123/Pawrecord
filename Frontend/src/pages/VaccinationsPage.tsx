// Function map (line numbers include this header):
// 1. vaccineStatus - line 23: Calculates the visible vaccination status.
// 2. VaccinationsPage - line 32: Renders or handles this feature.
// 3. load - line 44: Renders or handles this feature.
// 4. submit - line 83: Renders or handles this feature.
//
import { Plus, Syringe, Pencil } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/ui/Avatar";
import { StatusChip } from "../components/ui/StatusChip";
import { supabase } from "../lib/supabase";
import { PageSkeleton } from "../components/ui/Skeleton";
import type { Pet, Vaccination } from "../lib/types";
import { friendlyDatabaseError } from "../lib/errors";

type VaccineType = { id: string; name: string; interval_days: number };
type VaccineForm = { petId: string; vaccineTypeId: string; givenOn: string };
const emptyForm: VaccineForm = {
  petId: "",
  vaccineTypeId: "",
  givenOn: new Date().toISOString().slice(0, 10),
};

function vaccineStatus(nextDueOn: string) {
  const days = Math.ceil(
    (new Date(`${nextDueOn}T00:00:00`).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
  return days < 0 ? "Overdue" : days <= 14 ? "Due soon" : "Current";
}

export function VaccinationsPage() {
  const { profile } = useAuth();
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [types, setTypes] = useState<VaccineType[]>([]);
  const [form, setForm] = useState<VaccineForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState("all");
  const [confirmation, setConfirmation] = useState<Vaccination | null>(null);
  const canEdit = profile?.role === "staff" || profile?.role === "vet";

  const load = async () => {
    if (!supabase) {
      setState("ready");
      return;
    }
    const [vaccinationResult, petResult, typeResult] = await Promise.all([
      supabase
        .from("vaccinations")
        .select(
          "id, pet_id, vaccine_type_id, given_on, next_due_on, pets(name, photo_url), vaccine_types(name)",
        )
        .order("next_due_on"),
      supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status",
        )
        .order("name"),
      supabase
        .from("vaccine_types")
        .select("id, name, interval_days")
        .order("name"),
    ]);
    const failure =
      vaccinationResult.error ?? petResult.error ?? typeResult.error;
    if (failure) {
      setError(friendlyDatabaseError(failure));
      setState("error");
      return;
    }
    setVaccinations((vaccinationResult.data ?? []) as unknown as Vaccination[]);
    setPets((petResult.data ?? []) as Pet[]);
    setTypes((typeResult.data ?? []) as VaccineType[]);
    setState("ready");
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !profile) return;
    setSaving(true);
    setError("");
    const result = await supabase.from("vaccinations").insert({
      pet_id: form.petId,
      vaccine_type_id: form.vaccineTypeId,
      given_on: form.givenOn,
      administered_by: profile.id,
    });
    if (result.error) setError(friendlyDatabaseError(result.error));
    else {
      setForm(emptyForm);
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };
  const openDoseConfirmation = (vaccination: Vaccination) => {
    setConfirmation(vaccination);
    setForm({
      petId: vaccination.pet_id,
      vaccineTypeId: vaccination.vaccine_type_id,
      givenOn: new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
  };
  const filteredVaccinations =
    selectedPetId === "all"
      ? vaccinations
      : vaccinations.filter(
          (vaccination) => vaccination.pet_id === selectedPetId,
        );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Preventive care
          </p>
          <h1 className="page-title mt-3">Vaccination records</h1>
          <p className="mt-2 text-sm text-text-muted">
            Track vaccine status and automate due-date reminders.
          </p>
        </div>
        {canEdit && (
          <button
            className="button-primary"
            type="button"
            onClick={() => {
              setConfirmation(null);
              setForm(emptyForm);
              setShowForm(!showForm);
            }}
          >
            <Plus size={16} /> Add record
          </button>
        )}
      </header>
      {showForm && (
        <form onSubmit={submit} className="panel grid gap-4 p-5 md:grid-cols-3">
          <h2 className="font-heading text-lg md:col-span-3">
            {confirmation
              ? `Confirm ${confirmation.vaccine_types?.name ?? "vaccination"} dose`
              : "Add vaccination record"}
          </h2>
          <label className="text-sm">
            Patient
            <select
              className="field mt-2"
              required
              disabled={Boolean(confirmation)}
              value={form.petId}
              onChange={(event) =>
                setForm({ ...form, petId: event.target.value })
              }
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
            Vaccine
            <select
              className="field mt-2"
              required
              disabled={Boolean(confirmation)}
              value={form.vaccineTypeId}
              onChange={(event) =>
                setForm({ ...form, vaccineTypeId: event.target.value })
              }
            >
              <option value="">Select a vaccine</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Given on
            <input
              className="field mt-2"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.givenOn}
              onChange={(event) =>
                setForm({ ...form, givenOn: event.target.value })
              }
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
              {saving ? "Saving…" : "Save record"}
            </button>
            <button
              className="rounded-xl border border-border px-4 text-sm"
              type="button"
              onClick={() => {
                setShowForm(false);
                setConfirmation(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state === "loading" && (
        <PageSkeleton />
      )}
      {state === "error" && (
        <p role="alert" className="panel p-5 text-sm text-primary-hover">
          {error}
        </p>
      )}
      {state === "ready" && (
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg">Immunization tracker</h2>
                <p className="text-xs text-text-muted">
                  Track vaccine status and due dates.
                </p>
              </div>
              <label className="text-xs text-text-muted">
                Filter by pet
                <select
                  className="field mt-1 min-w-44 py-2 text-sm"
                  value={selectedPetId}
                  onChange={(event) => setSelectedPetId(event.target.value)}
                >
                  <option value="all">All pets</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {filteredVaccinations.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              {vaccinations.length === 0
                ? "No vaccination records yet."
                : "No vaccination records found for this pet."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredVaccinations.map((vaccination) => {
                const status = vaccineStatus(vaccination.next_due_on);
                return (
                  <article
                    key={vaccination.id}
                    className="flex items-center gap-3 p-4"
                  >
                    <Avatar
                      name={vaccination.pets?.name ?? "Pet"}
                      src={vaccination.pets?.photo_url}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {vaccination.vaccine_types?.name ?? "Vaccine"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {vaccination.pets?.name ?? "Patient"} · Given{" "}
                        {vaccination.given_on} · Next due{" "}
                        {vaccination.next_due_on}
                      </p>
                    </div>
                    <StatusChip
                      label={status}
                      tone={status === "Current" ? "neutral" : "rose"}
                    />
                    {canEdit ? (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-text-muted hover:bg-surface-inner hover:text-primary"
                        aria-label={`Record another ${vaccination.vaccine_types?.name ?? "vaccination"} dose for ${vaccination.pets?.name ?? "this pet"}`}
                        title="Confirm another dose"
                        onClick={() => openDoseConfirmation(vaccination)}
                      >
                        <Pencil size={16} />
                      </button>
                    ) : (
                      <Syringe
                        size={16}
                        className="hidden text-text-muted sm:block"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
