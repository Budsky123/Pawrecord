// Function map (line numbers include this header):
// 1. json - line 31: Creates a JSON HTTP response.
// 2. requiredEnv - line 37: Reads a required server environment variable.
// 3. clinicDate - line 43: Formats dates in the clinic timezone.
// 4. escapeHtml - line 50: Escapes text before inserting it into email HTML.
// 5. authorize - line 60: Validates function or staff authorization.
// 6. findSources - line 86: Finds upcoming vaccination and appointment reminders.
// 7. deliver - line 159: Claims and sends one reminder email.
// 8. Deno.serve HTTP handler - line 232: Receives and processes backend HTTP requests.
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReminderSource = {
  id: string;
  pet_id: string;
  sent_to: string;
  pet_name: string;
  label: string;
  due_on: string;
  type: "vaccination" | "appointment";
  vaccination_id?: string;
  appointment_id?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function clinicDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    date,
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

async function authorize(
  request: Request,
  admin: ReturnType<typeof createClient>,
) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && request.headers.get("x-cron-secret") === cronSecret)
    return "cron";
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new Error("Authentication is required.");
  const { data: userData, error: userError } = await admin.auth.getUser(
    authorization.slice("Bearer ".length),
  );
  if (userError || !userData.user)
    throw new Error("Authentication is required.");
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["staff", "vet"].includes(profile.role))
    throw new Error("Only clinic staff can send reminders.");
  return userData.user.id;
}

async function findSources(
  admin: ReturnType<typeof createClient>,
  petId?: string,
): Promise<ReminderSource[]> {
  const dueStart = clinicDate();
  const dueEnd = clinicDate(8);
  const vaccinationQuery = admin
    .from("vaccines_due")
    .select(
      "vaccination_id, pet_id, owner_id, pet_name, vaccine_name, next_due_on",
    )
    .gte("next_due_on", dueStart)
    .lt("next_due_on", dueEnd);
  if (petId) vaccinationQuery.eq("pet_id", petId);
  const { data: vaccinations, error: vaccinationError } =
    await vaccinationQuery;
  if (vaccinationError) throw vaccinationError;

  const ownerIds = [
    ...new Set((vaccinations ?? []).map((item) => item.owner_id)),
  ];
  const { data: owners, error: ownerError } = ownerIds.length
    ? await admin.from("owners").select("id, email").in("id", ownerIds)
    : { data: [], error: null };
  if (ownerError) throw ownerError;
  const emails = new Map(
    (owners ?? []).map((owner) => [owner.id, owner.email]),
  );
  const sources: ReminderSource[] = (vaccinations ?? [])
    .map((item) => ({
      id: item.vaccination_id,
      pet_id: item.pet_id,
      sent_to: emails.get(item.owner_id) ?? "",
      pet_name: item.pet_name,
      label: `${item.vaccine_name} vaccination`,
      due_on: item.next_due_on,
      type: "vaccination",
      vaccination_id: item.vaccination_id,
    }))
    .filter((item) => item.sent_to);

  let appointmentQuery = admin
    .from("appointments")
    .select("id, pet_id, starts_at, reason, pets(name, owners(email))")
    .gte("starts_at", `${clinicDate(1)}T00:00:00+08:00`)
    .lt("starts_at", `${clinicDate(2)}T00:00:00+08:00`)
    .in("status", ["pending", "confirmed"]);
  if (petId) appointmentQuery = appointmentQuery.eq("pet_id", petId);
  const { data: appointments, error: appointmentError } =
    await appointmentQuery;
  if (appointmentError) throw appointmentError;
  for (const appointment of appointments ?? []) {
    const pet = Array.isArray(appointment.pets)
      ? appointment.pets[0]
      : appointment.pets;
    const owner =
      pet?.owners && (Array.isArray(pet.owners) ? pet.owners[0] : pet.owners);
    if (owner?.email) {
      sources.push({
        id: appointment.id,
        pet_id: appointment.pet_id,
        sent_to: owner.email,
        pet_name: pet.name,
        label: `Appointment: ${appointment.reason}`,
        due_on: clinicDate(1),
        type: "appointment",
        appointment_id: appointment.id,
      });
    }
  }
  return sources;
}

async function deliver(
  admin: ReturnType<typeof createClient>,
  source: ReminderSource,
  resendKey: string,
  resendApiKey: string,
  from: string,
) {
  const sourceColumn =
    source.type === "vaccination" ? "vaccination_id" : "appointment_id";
  const sourceId =
    source.type === "vaccination"
      ? source.vaccination_id
      : source.appointment_id;
  const { data: existing, error: existingError } = await admin
    .from("reminders")
    .select("id, status")
    .eq(sourceColumn, sourceId)
    .eq("due_on", source.due_on)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "sent") return "skipped";

  const { data: reminder, error: claimError } = await admin
    .from("reminders")
    .upsert(
      {
        pet_id: source.pet_id,
        type: source.type,
        sent_to: source.sent_to,
        due_on: source.due_on,
        [sourceColumn]: sourceId,
        status: "pending",
        error_message: null,
      },
      { onConflict: `${sourceColumn},due_on`, ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (claimError) throw claimError;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": resendKey,
    },
    body: JSON.stringify({
      from,
      to: [source.sent_to],
      subject: `PawRecord reminder for ${source.pet_name}`,
      html: `<p>Hello,</p><p>This is a reminder that <strong>${escapeHtml(source.pet_name)}</strong> has ${escapeHtml(source.label).toLowerCase()} due on <strong>${escapeHtml(source.due_on)}</strong>.</p><p>Please contact Pawsitive Pet Health to arrange the next visit.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    await admin
      .from("reminders")
      .update({ status: "failed", error_message: detail.slice(0, 500) })
      .eq("id", reminder.id);
    throw new Error(`Resend rejected the email: ${response.status}`);
  }
  await admin
    .from("reminders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", reminder.id);
  return "sent";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    await authorize(request, admin);
    const body =
      request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const sources = await findSources(
      admin,
      typeof body.petId === "string" ? body.petId : undefined,
    );
    const resendApiKey = requiredEnv("RESEND_API_KEY");
    const from = requiredEnv("REMINDER_FROM_EMAIL");
    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];
    for (const source of sources) {
      try {
        const result = await deliver(
          admin,
          source,
          `pawrecord-${source.type}-${source.id}-${source.due_on}`,
          resendApiKey,
          from,
        );
        if (result === "sent") sent += 1;
        else skipped += 1;
      } catch (error) {
        failures.push(
          `${source.pet_name}: ${error instanceof Error ? error.message : "delivery failed"}`,
        );
      }
    }
    return json({ considered: sources.length, sent, skipped, failures });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send reminders.",
      },
      400,
    );
  }
});
