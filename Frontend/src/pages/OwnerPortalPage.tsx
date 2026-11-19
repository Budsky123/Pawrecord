// Function map (line numbers include this header):
// 1. OwnerPortalPage - line 19: Renders or handles this feature.
// 2. uploadPetPhoto - line 32: Renders or handles this feature.
//
import {
  CalendarPlus,
  ClipboardList,
  ImagePlus,
  PawPrint,
  Syringe,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { StatusChip } from "../components/ui/StatusChip";
import { supabase } from "../lib/supabase";
import type { Appointment, Pet, VaccineDue, Visit } from "../lib/types";
import { friendlyDatabaseError } from "../lib/errors";

export function OwnerPortalPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [due, setDue] = useState<VaccineDue[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    supabase ? "loading" : "ready",
  );
  const [error, setError] = useState("");
  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadPetPhoto = async (
    pet: Pet,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!supabase || !file) return;
    if (!file.type.startsWith("image/")) {
      setUploadMessage("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage("Please choose an image smaller than 5 MB.");
      return;
    }
    setUploadingPetId(pet.id);
    setUploadMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${pet.owner_id}/${pet.id}.${extension}`;
    const upload = await supabase.storage
      .from("pet-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upload.error) {
      setUploadMessage(friendlyDatabaseError(upload.error));
      setUploadingPetId(null);
      return;
    }
    const photoUrl = path;
    const update = await supabase
      .from("pets")
      .update({ photo_url: photoUrl })
      .eq("id", pet.id);
    if (update.error) setUploadMessage(friendlyDatabaseError(update.error));
    else {
      setPets((current) =>
        current.map((item) =>
          item.id === pet.id ? { ...item, photo_url: photoUrl } : item,
        ),
      );
      setUploadMessage(`${pet.name}'s profile picture was updated.`);
    }
    setUploadingPetId(null);
  };

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase
        .from("pets")
        .select(
          "id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status",
        )
        .order("name"),
      supabase
        .from("appointments")
        .select(
          "id, pet_id, vet_id, starts_at, ends_at, reason, status, pets(name, photo_url, owners(full_name)), profiles(full_name)",
        )
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
      supabase
        .from("visits")
        .select(
          "id, pet_id, visit_date, reason, category, diagnosis, treatment, notes, pets(name, photo_url), profiles(full_name)",
        )
        .is("deleted_at", null)
        .order("visit_date", { ascending: false })
        .limit(6),
      supabase
        .from("vaccines_due")
        .select(
          "vaccination_id, pet_id, pet_name, vaccine_name, next_due_on, days_until_due, status",
        )
        .limit(7),
    ]).then(([petResult, appointmentResult, visitResult, dueResult]) => {
      const failure =
        petResult.error ??
        appointmentResult.error ??
        visitResult.error ??
        dueResult.error;
      if (failure) {
        setError(friendlyDatabaseError(failure));
        setState("error");
        return;
      }
      const loadedPets = (petResult.data ?? []) as Pet[];
      setPets(loadedPets);
      setSelectedPetId((current) =>
        current && loadedPets.some((pet) => pet.id === current)
          ? current
          : (loadedPets[0]?.id ?? null),
      );
      setAppointments(
        (appointmentResult.data ?? []) as unknown as Appointment[],
      );
      setVisits((visitResult.data ?? []) as unknown as Visit[]);
      setDue((dueResult.data ?? []) as VaccineDue[]);
      setState("ready");
    });
  }, []);

  if (state === "loading")
    return (
      <p className="panel p-5 text-sm text-text-muted">
        Loading your pet portal…
      </p>
    );
  if (state === "error")
    return (
      <p role="alert" className="panel p-5 text-sm text-primary-hover">
        {error}
      </p>
    );
  const selectedPet =
    pets.find((pet) => pet.id === selectedPetId) ?? pets[0];
  const selectedAppointments = selectedPet
    ? appointments.filter(
        (appointment) => appointment.pet_id === selectedPet.id,
      )
    : [];
  const selectedDue = selectedPet
    ? due.filter((item) => item.pet_id === selectedPet.id)
    : [];
  const selectedVisits = selectedPet
    ? visits.filter((visit) => visit.pet_id === selectedPet.id)
    : [];
  const nextAppointment = selectedAppointments[0];

  return (
    <div className="space-y-6 sm:space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Owner portal
        </p>
        <h1 className="page-title mt-3">
          {selectedPet
            ? `Welcome back. ${selectedPet.name}'s care is here.`
            : "Your pet care, all in one place."}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Review your pets, upcoming visits, health history, and preventive
          care.
        </p>
      </header>
      {pets.length === 0 ? (
        <section className="panel p-8 text-center">
          <PawPrint className="mx-auto text-primary" />
          <p className="mt-3 text-sm text-text-muted">
            No pets are linked to your owner account yet.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="panel p-5">
              <p className="text-xs text-text-muted">My pets</p>
              <p className="mt-2 font-heading text-3xl">{pets.length}</p>
              <p className="mt-1 text-xs text-text-muted">
                Linked to your account
              </p>
            </article>
            <article className="panel p-5">
              <p className="text-xs text-text-muted">Upcoming visits</p>
              <p className="mt-2 font-heading text-3xl">
                {selectedAppointments.length}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Scheduled appointments
              </p>
            </article>
            <article className="panel p-5">
              <p className="text-xs text-text-muted">Care items due</p>
              <p className="mt-2 font-heading text-3xl">{selectedDue.length}</p>
              <p className="mt-1 text-xs text-text-muted">
                Vaccinations needing attention
              </p>
            </article>
          </section>
          <section className="panel flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
            <div className="flex items-center gap-4 sm:block">
              <div className="relative">
                <Avatar
                  name={selectedPet.name}
                  src={selectedPet.photo_url}
                  className="h-24 w-24 text-2xl"
                />
                <button
                  type="button"
                  aria-label={`Upload a profile picture for ${selectedPet.name}`}
                  onClick={() => fileInputs.current[selectedPet.id]?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-white shadow-primary hover:bg-primary-hover"
                >
                  <ImagePlus size={14} />
                </button>
                <input
                  ref={(element) => {
                    fileInputs.current[selectedPet.id] = element;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void uploadPetPhoto(selectedPet, event)}
                />
              </div>
              <div className="sm:hidden">
                <p className="text-sm text-text-muted">
                  {selectedPet.species} · {selectedPet.breed ?? "Mixed breed"}
                </p>
                <h2 className="font-heading text-2xl leading-tight">
                  {selectedPet.name}
                </h2>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="hidden text-sm text-text-muted sm:block">
                {selectedPet.species} · {selectedPet.breed ?? "Mixed breed"}
              </p>
              <h2 className="hidden font-heading text-2xl sm:block">
                {selectedPet.name}
              </h2>
              <p className="text-xs text-text-muted">
                {selectedPet.birth_date
                  ? `Born ${selectedPet.birth_date}`
                  : "Birth date not recorded"}
              </p>
              <StatusChip
                label={selectedPet.health_status.replace("_", " ")}
                tone="neutral"
              />
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Tap the image button to update the photo.
              </p>
            </div>
            <Link
              to="/appointments?book=1"
              className="button-primary w-full sm:w-auto"
            >
              <CalendarPlus size={16} /> Book a visit
            </Link>
          </section>
          {uploadMessage && (
            <p
              role="status"
              className="rounded-xl border border-border bg-surface-inner p-3 text-sm text-primary-hover"
            >
              {uploadMessage}
            </p>
          )}
          {pets.length > 1 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-lg">My pets</h2>
                <Link className="text-xs text-primary" to="/medical-records">
                  View care records →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pets.map((pet) => (
                  <article
                    key={pet.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      pet.id === selectedPet.id
                        ? "border-primary bg-status-rose"
                        : "border-border bg-surface hover:bg-status-rose"
                    }`}
                    onClick={() => setSelectedPetId(pet.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPetId(pet.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={pet.id === selectedPet.id}
                  >
                    <div className="relative">
                      <Avatar
                        name={pet.name}
                        src={pet.photo_url}
                        className="h-12 w-12"
                      />
                      <button
                        type="button"
                        aria-label={`Upload a profile picture for ${pet.name}`}
                        onClick={() => fileInputs.current[pet.id]?.click()}
                        className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-white hover:bg-primary-hover"
                      >
                        <ImagePlus size={11} />
                      </button>
                      <input
                        ref={(element) => {
                          fileInputs.current[pet.id] = element;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void uploadPetPhoto(pet, event)}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pet.name}</p>
                      <p className="text-xs text-text-muted">
                        {pet.species} · {pet.breed ?? "Mixed breed"}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {uploadingPetId === pet.id
                          ? "Uploading…"
                          : pet.health_status.replace("_", " ")}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-heading text-lg">
                  <CalendarPlus size={17} className="text-primary" /> Next
                  appointment
                </h2>
                <Link className="text-xs text-primary" to="/appointments">
                  View all →
                </Link>
              </div>
              {nextAppointment ? (
                <div className="mt-4 rounded-xl bg-surface-inner p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{nextAppointment.reason}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {nextAppointment.pets.name} ·{" "}
                        {new Date(nextAppointment.starts_at).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Vet:{" "}
                        {nextAppointment.profiles?.full_name ?? "Clinic team"}
                      </p>
                    </div>
                    <StatusChip label={nextAppointment.status} />
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">
                  No upcoming appointments. Book your pet's next visit when
                  ready.
                </p>
              )}
            </div>
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-heading text-lg">
                  <Syringe size={17} className="text-primary" /> Preventive care
                </h2>
                <Link className="text-xs text-primary" to="/vaccinations">
                  View all →
                </Link>
              </div>
              {selectedDue.length === 0 ? (
                <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">
                  All vaccination care is current.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedDue.slice(0, 4).map((item) => (
                    <div
                      key={item.vaccination_id}
                      className="flex items-center justify-between rounded-xl bg-surface-inner p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {item.vaccine_name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {item.pet_name} · Due {item.next_due_on}
                        </p>
                      </div>
                      <StatusChip
                        label={
                          item.status === "overdue"
                            ? "Overdue"
                            : `${item.days_until_due} days`
                        }
                        tone="rose"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-lg">
                <ClipboardList size={17} className="text-primary" /> Recent care
                history
              </h2>
              <Link className="text-xs text-primary" to="/medical-records">
                View records →
              </Link>
            </div>
            {selectedVisits.length === 0 ? (
              <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">
                No medical records have been added yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-border">
                {selectedVisits.map((visit) => (
                  <article
                    key={visit.id}
                    className="flex items-start gap-3 py-3"
                  >
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{visit.reason}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {visit.pets?.name ?? "Pet"} ·{" "}
                        {new Date(visit.visit_date).toLocaleDateString()} ·{" "}
                        {visit.profiles?.full_name ?? "Clinic team"}
                      </p>
                      {visit.diagnosis && (
                        <p className="mt-2 text-xs text-text-muted">
                          {visit.diagnosis}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-surface-inner px-2.5 py-1 text-xs">
                      {visit.category}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
