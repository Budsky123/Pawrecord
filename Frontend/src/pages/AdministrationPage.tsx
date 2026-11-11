// Function map (line numbers include this header):
// 1. AdministrationPage - line 17: Renders or handles this feature.
// 2. load - line 36: Renders or handles this feature.
// 3. linkOwner - line 59: Renders or handles this feature.
// 4. updateRole - line 83: Renders or handles this feature.
// 5. inviteUser - line 102: Renders or handles this feature.
//
import { Pencil, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/ui/Avatar";
import { supabase } from "../lib/supabase";
import type { AppRole, OwnerAccount, Profile } from "../lib/types";

type NewUser = { email: string; fullName: string; role: AppRole };

export function AdministrationPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [owners, setOwners] = useState<OwnerAccount[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>({
    email: "",
    fullName: "",
    role: "owner",
  });
  const [search, setSearch] = useState("");
  const canAdminister = profile?.role === "staff" || profile?.role === "vet";

  const load = async () => {
    if (!supabase) return;
    const [profileResult, ownerResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, phone")
        .order("full_name"),
      supabase
        .from("owners")
        .select("id, full_name, profile_id")
        .order("full_name"),
    ]);
    const failure = profileResult.error ?? ownerResult.error;
    if (failure) {
      setError(failure.message);
      setState("error");
      return;
    }
    setProfiles((profileResult.data ?? []) as Profile[]);
    setOwners((ownerResult.data ?? []) as OwnerAccount[]);
    setState("ready");
  };

  const linkOwner = async (owner: OwnerAccount, profileId: string) => {
    if (!supabase) return;
    setError("");
    setMessage("");
    const result = await supabase
      .from("owners")
      .update({ profile_id: profileId || null })
      .eq("id", owner.id);
    if (result.error) setError(result.error.message);
    else {
      setOwners((current) =>
        current.map((item) =>
          item.id === owner.id
            ? { ...item, profile_id: profileId || null }
            : item,
        ),
      );
      setMessage(`${owner.full_name}'s owner account was linked.`);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const updateRole = async (person: Profile, role: AppRole) => {
    if (!supabase || role === person.role) return;
    setError("");
    setMessage("");
    const result = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", person.id);
    if (result.error) setError(result.error.message);
    else {
      setProfiles((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, role } : item,
        ),
      );
      setMessage(`${person.full_name}'s role was updated.`);
    }
  };

  const inviteUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError("");
    setMessage("");
    const result = await supabase.functions.invoke("admin-create-user", {
      body: newUser,
    });
    if (result.error) setError(result.error.message);
    else {
      setMessage(`Invitation sent to ${newUser.email}.`);
      setNewUser({ email: "", fullName: "", role: "owner" });
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  if (!canAdminister)
    return (
      <p role="alert" className="panel p-5 text-sm text-primary-hover">
        You do not have permission to access administration.
      </p>
    );
  if (state === "loading")
    return (
      <p className="panel p-5 text-sm text-text-muted">Loading peopleâ€¦</p>
    );
  if (state === "error")
    return (
      <p role="alert" className="panel p-5 text-sm text-primary-hover">
        {error}
      </p>
    );
  const filteredProfiles = profiles.filter((person) =>
    person.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Clinic administration
          </p>
          <h1 className="page-title mt-3">People & access</h1>
          <p className="mt-2 text-sm text-text-muted">
            Manage the people who can access PawRecord and their roles.
          </p>
        </div>
        <button
          className="button-primary"
          type="button"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} /> Add user
        </button>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-border bg-surface-inner p-3 text-sm text-primary-hover"
        >
          {message}
        </p>
      )}
      {showForm && (
        <form
          onSubmit={inviteUser}
          className="panel grid gap-4 p-5 md:grid-cols-3"
        >
          <div className="flex items-start justify-between md:col-span-3">
            <div>
              <h2 className="font-heading text-lg">Invite a new user</h2>
              <p className="mt-1 text-xs text-text-muted">
                They will receive an email invitation to set their password.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close invite form"
              onClick={() => setShowForm(false)}
              className="text-text-muted hover:text-primary"
            >
              <X size={17} />
            </button>
          </div>
          <label className="text-sm">
            Full name
            <input
              className="field mt-2"
              required
              value={newUser.fullName}
              onChange={(event) =>
                setNewUser({ ...newUser, fullName: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Email
            <input
              className="field mt-2"
              type="email"
              required
              value={newUser.email}
              onChange={(event) =>
                setNewUser({ ...newUser, email: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Role
            <select
              className="field mt-2"
              value={newUser.role}
              onChange={(event) =>
                setNewUser({ ...newUser, role: event.target.value as AppRole })
              }
            >
              <option value="owner">Owner</option>
              <option value="vet">Vet</option>
              <option value="staff">Staff</option>
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
          <button
            className="button-primary md:col-span-3 md:w-fit"
            type="submit"
            disabled={saving}
          >
            {saving ? "Sending invitationâ€¦" : "Send invitation"}
          </button>
        </form>
      )}
      <section
        id="owner-account-links"
        className="panel border-2 border-primary/30 bg-surface p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Important
            </p>
            <h2 className="mt-1 font-heading text-lg">Link owner accounts</h2>
            <p className="mt-1 text-xs text-text-muted">
              Hazel and Paulâ€™s pets will appear in their portal after their
              owner record is linked to their login account.
            </p>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
            {owners.filter((owner) => owner.profile_id).length}/{owners.length}{" "}
            linked
          </span>
        </div>
        <div className="mt-4 divide-y divide-border">
          {owners
            .filter(
              (owner) =>
                !search.trim() ||
                owner.full_name
                  .toLowerCase()
                  .includes(search.trim().toLowerCase()),
            )
            .map((owner) => (
              <div
                key={owner.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium">{owner.full_name}</p>
                  <p className="text-xs text-text-muted">
                    {owner.profile_id
                      ? "Linked â€” pets are visible to this owner"
                      : "Not linked yet"}
                  </p>
                </div>
                <select
                  className="field max-w-xs py-2 text-xs"
                  aria-label={`Link account for ${owner.full_name}`}
                  value={owner.profile_id ?? ""}
                  onChange={(event) =>
                    void linkOwner(owner, event.target.value)
                  }
                >
                  <option value="">Not linked</option>
                  {profiles
                    .filter((person) => person.role === "owner")
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          {owners.length === 0 && (
            <p className="mt-4 text-sm text-text-muted">
              No owner records found.
            </p>
          )}
          {owners.length > 0 &&
            search.trim() &&
            !owners.some((owner) =>
              owner.full_name
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
            ) && (
              <p className="mt-4 text-sm text-text-muted">
                No owner matches â€œ{search}â€. Clear the people search to see
                all owners.
              </p>
            )}
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-heading text-lg">
              {filteredProfiles.length} people
            </h2>
            <p className="text-xs text-text-muted">
              Roles control access to clinic features.
            </p>
          </div>
          <label className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              className="field h-9 min-h-0 pl-9"
              type="search"
              placeholder="Search by name..."
              aria-label="Search people by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {profiles.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">
            No profiles found.
          </p>
        ) : filteredProfiles.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">
            No people match â€œ{search}â€.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filteredProfiles.map((person) => (
              <article
                key={person.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <Avatar name={person.full_name} className="h-10 w-10" />
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium">{person.full_name}</p>
                </div>
                <span className="hidden items-center gap-1 text-xs text-text-muted sm:flex">
                  <ShieldCheck size={14} /> Access role
                </span>
                <select
                  aria-label={`Role for ${person.full_name}`}
                  className="rounded-xl border border-border bg-surface-inner px-3 py-2 text-xs"
                  value={person.role}
                  onChange={(event) =>
                    void updateRole(person, event.target.value as AppRole)
                  }
                >
                  <option value="owner">Owner</option>
                  <option value="vet">Vet</option>
                  <option value="staff">Staff</option>
                </select>
                <Pencil size={14} className="text-text-muted" />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
