// Function map (line numbers include this header):
// 1. MedicalRecordsPage - line 29: Renders or handles this feature.
// 2. load - line 41: Renders or handles this feature.
// 3. submit - line 81: Renders or handles this feature.
//
import { ClipboardPlus, FileText } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import type { Pet, Profile, Visit } from "../lib/types";

type VisitForm = {
  petId: string;
  reason: string;
  category: string;
  diagnosis: string;
  treatment: string;
  notes: string;
};
const emptyForm: VisitForm = {
  petId: "",
  reason: "",
  category: "wellness",
  diagnosis: "",
  treatment: "",
  notes: "",
};

export function MedicalRecordsPage() {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [vets, setVets] = useState<Profile[]>([]);
  const [form, setForm] = useState<VisitForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = profile?.role === "staff" || profile?.role === "vet";

  const load = async () => {
    if (!supabase) {
      setState("ready");
      return;
    }
    const [visitResult, petResult, vetResult] = await Promise.all([
      supabase
        .from("visits")
        .select(
          "id, visit_date, reason, category, diagnosis, treatment, notes, pets(name, photo_url), profiles(full_name)",
        )
        .is("deleted_at", null)
        .order("visit_date", { ascending: false }),
      supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status",
        )
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, role, phone")
        .eq("role", "vet")
        .order("full_name"),
    ]);
    const failure = visitResult.error ?? petResult.error ?? vetResult.error;
    if (failure) {
      setError(failure.message);
      setState("error");
      return;
    }
    setVisits((visitResult.data ?? []) as unknown as Visit[]);
    setPets((petResult.data ?? []) as unknown as Pet[]);
    setVets((vetResult.data ?? []) as Profile[]);
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
    const result = await supabase.from("visits").insert({
      pet_id: form.petId,
      vet_id: profile.role === "vet" ? profile.id : vets[0]?.id,
      reason: form.reason,
      category: form.category,
      diagnosis: form.diagnosis || null,
      treatment: form.treatment || null,
      notes: form.notes || null,
    });
    if (result.error) setError(result.error.message);
    else {
      setForm(emptyForm);
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Care records
          </p>
          <h1 className="page-title mt-3">Medical history</h1>
          <p className="mt-2 text-sm text-text-muted">
            A complete, searchable timeline of every patient visit.
          </p>
        </div>
        {canEdit && (
          <button
            className="button-primary"
            type="button"
            onClick={() => setShowForm(!showForm)}
          >
            <ClipboardPlus size={16} /> Add record
          </button>
        )}
      </header>
      {showForm && (
        <form onSubmit={submit} className="panel grid gap-4 p-5 md:grid-cols-2">
          <h2 className="font-heading text-lg md:col-span-2">
            Add clinical record
          </h2>
          <label className="text-sm">
            Patient
            <select
              className="field mt-2"
              required
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
            Category
            <select
              className="field mt-2"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              <option value="wellness">Wellness</option>
              <option value="vaccination">Vaccination</option>
              <option value="dental">Dental</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Reason
            <input
              className="field mt-2"
              required
              value={form.reason}
              onChange={(event) =>
                setForm({ ...form, reason: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Diagnosis
            <textarea
              className="field mt-2 py-2"
              rows={3}
              value={form.diagnosis}
              onChange={(event) =>
                setForm({ ...form, diagnosis: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Treatment
            <textarea
              className="field mt-2 py-2"
              rows={3}
              value={form.treatment}
              onChange={(event) =>
                setForm({ ...form, treatment: event.target.value })
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            Notes
            <textarea
              className="field mt-2 py-2"
              rows={2}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>
          {error && (
            <p
              role="alert"
              className="text-sm text-primary-hover md:col-span-2"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2 md:col-span-2">
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? "Savingâ€¦" : "Save record"}
            </button>
            <button
              className="rounded-xl border border-border px-4 text-sm"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state === "loading" && (
        <p className="panel p-5 text-sm text-text-muted">
          Loading clinical recordsâ€¦
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="panel p-5 text-sm text-primary-hover">
          {error}
        </p>
      )}
      {state === "ready" && (
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="font-heading text-lg">Recent clinical records</h2>
            <p className="text-xs text-text-muted">All clinic locations</p>
          </div>
          {visits.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              No medical records yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visits.map((visit) => (
                <article key={visit.id} className="flex items-start gap-3 p-4">
                  <span className="rounded-xl bg-surface-inner p-2.5 text-primary">
                    <FileText size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{visit.reason}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {visit.pets?.name ?? "Patient"} Â·{" "}
                      {new Date(visit.visit_date).toLocaleDateString()} Â·{" "}
                      {visit.profiles?.full_name ?? "Veterinary team"}
                    </p>
                    {visit.diagnosis && (
                      <p className="mt-2 text-sm text-text-muted">
                        {visit.diagnosis}
                      </p>
                    )}
                  </div>
                  <span className="hidden rounded-full bg-surface-inner px-2.5 py-1 text-xs sm:block">
                    {visit.category}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
