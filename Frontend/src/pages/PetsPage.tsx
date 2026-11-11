// Function map (line numbers include this header):
// 1. PetsPage - line 14: Renders or handles this feature.
// 2. addPet - line 56: Renders or handles this feature.
//
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/ui/Avatar";
import { StatusChip } from "../components/ui/StatusChip";
import { supabase } from "../lib/supabase";
import type { Pet } from "../lib/types";

export function PetsPage() {
  const { profile } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ownerId: "",
    name: "",
    species: "Dog",
    breed: "",
    birthDate: "",
    sex: "unknown",
  });
  const canEdit = profile?.role === "staff" || profile?.role === "vet";
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status, owners(full_name, email)",
        )
        .order("name"),
      supabase.from("owners").select("id, full_name").order("full_name"),
    ]).then(([petResult, ownerResult]) => {
      const resultError = petResult.error ?? ownerResult.error;
      if (resultError) {
        setError(resultError.message);
        setState("error");
        return;
      }
      setPets((petResult.data ?? []) as unknown as Pet[]);
      setOwners(ownerResult.data ?? []);
      setState("ready");
    });
  }, []);
  const addPet = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError("");
    const result = await supabase.from("pets").insert({
      owner_id: form.ownerId,
      name: form.name,
      species: form.species,
      breed: form.breed || null,
      birth_date: form.birthDate || null,
      sex: form.sex,
      health_status: "healthy",
    });
    if (result.error) setError(result.error.message);
    else {
      setForm({
        ownerId: "",
        name: "",
        species: "Dog",
        breed: "",
        birthDate: "",
        sex: "unknown",
      });
      setShowForm(false);
      const refreshed = await supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status, owners(full_name, email)",
        )
        .order("name");
      if (refreshed.error) setError(refreshed.error.message);
      else setPets((refreshed.data ?? []) as unknown as Pet[]);
    }
    setSaving(false);
  };
  const filtered = useMemo(
    () =>
      pets.filter((pet) =>
        `${pet.name} ${pet.breed ?? ""} ${pet.owners?.full_name ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [pets, query],
  );
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Patients
          </p>
          <h1 className="page-title mt-3">Pet profiles</h1>
          <p className="mt-2 text-sm text-text-muted">
            Manage patient details, health summaries, and owner information.
          </p>
        </div>
        {canEdit && (
          <button
            className="button-primary"
            type="button"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={16} /> Add pet
          </button>
        )}
      </header>
      {showForm && (
        <form onSubmit={addPet} className="panel grid gap-4 p-5 md:grid-cols-3">
          <h2 className="font-heading text-lg md:col-span-3">
            Add patient profile
          </h2>
          <label className="text-sm">
            Owner
            <select
              className="field mt-2"
              required
              value={form.ownerId}
              onChange={(event) =>
                setForm({ ...form, ownerId: event.target.value })
              }
            >
              <option value="">Select an owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Pet name
            <input
              className="field mt-2"
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Species
            <input
              className="field mt-2"
              required
              value={form.species}
              onChange={(event) =>
                setForm({ ...form, species: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Breed
            <input
              className="field mt-2"
              value={form.breed}
              onChange={(event) =>
                setForm({ ...form, breed: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Birth date
            <input
              className="field mt-2"
              type="date"
              value={form.birthDate}
              onChange={(event) =>
                setForm({ ...form, birthDate: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Sex
            <select
              className="field mt-2"
              value={form.sex}
              onChange={(event) =>
                setForm({ ...form, sex: event.target.value })
              }
            >
              <option value="unknown">Unknown</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
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
              {saving ? "Savingâ€¦" : "Save pet"}
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
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-heading text-lg">{pets.length} patients</h2>
            <p className="text-xs text-text-muted">All clinic patients</p>
          </div>
          <label className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              className="field h-9 min-h-0 pl-9"
              placeholder="Search patients..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {state === "loading" && (
          <p className="p-5 text-sm text-text-muted">
            Loading patient profilesâ€¦
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="p-5 text-sm text-primary-hover">
            {error}
          </p>
        )}
        {state === "ready" && filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-text-muted">
            No patients match your search.
          </p>
        )}
        {state === "ready" && filtered.length > 0 && (
          <div className="divide-y divide-border">
            {filtered.map((pet) => (
              <Link
                to={`/pets/${pet.id}`}
                key={pet.id}
                className="grid grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-inner/60"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={pet.name} src={pet.photo_url} />
                  <div>
                    <p className="text-sm font-medium">{pet.name}</p>
                    <p className="text-xs text-text-muted">
                      {pet.breed ?? pet.species} Â·{" "}
                      {pet.birth_date
                        ? `${new Date().getFullYear() - new Date(pet.birth_date).getFullYear()} years`
                        : "Age unknown"}
                    </p>
                  </div>
                </div>
                <p className="text-sm">
                  {pet.owners?.full_name ?? "Unassigned"}
                </p>
                <StatusChip
                  label={
                    pet.health_status === "follow_up"
                      ? "Follow-up"
                      : pet.health_status === "medication"
                        ? "Medication"
                        : "Healthy"
                  }
                  tone={
                    pet.health_status === "healthy"
                      ? "neutral"
                      : pet.health_status === "follow_up"
                        ? "rose"
                        : "medication"
                  }
                />
                <p className="text-xs text-text-muted">View patient â†’</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
