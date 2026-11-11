// Function map (line numbers include this header):
// 1. response - line 12: Creates a JSON HTTP response.
// 2. Deno.serve HTTP handler - line 18: Receives and processes backend HTTP requests.
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey)
      throw new Error("Supabase service configuration is missing.");
    const admin = createClient(url, serviceKey);
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Authentication is required.");
    const { data: authData, error: authError } =
      await admin.auth.getUser(token);
    if (authError || !authData.user)
      throw new Error("Authentication is required.");
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor || !["staff", "vet"].includes(actor.role))
      throw new Error("Only staff and vets can invite users.");
    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
      role?: "owner" | "vet" | "staff";
    };
    if (!body.email || !body.fullName || !body.role)
      throw new Error("Email, full name, and role are required.");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      body.email,
      { data: { full_name: body.fullName } },
    );
    if (error || !data.user)
      throw error ?? new Error("Unable to create the user invitation.");
    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: body.fullName, role: body.role })
      .eq("id", data.user.id);
    if (profileError) throw profileError;
    return response({ id: data.user.id });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error ? error.message : "Unable to invite user.",
      },
      400,
    );
  }
});
