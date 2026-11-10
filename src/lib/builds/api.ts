import "server-only";
import { getCurrentAccount, type CurrentAccount } from "../auth/session";
import { UploadError } from "./upload";

// Shared checks for the build API route handlers (route handlers don't get server actions' built-in checks).

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The signed-in admin, or an error response. Writes must also come from this site (no cross-site requests). */
export async function adminOrError(req: Request, write = false): Promise<CurrentAccount | Response> {
  if (write) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: "Cross-site request refused." }, 403);
  }
  const me = await getCurrentAccount();
  if (!me) return json({ error: "Sign in again." }, 401);
  if (me.role !== "admin") return json({ error: "Only admins can manage game builds." }, 403);
  return me;
}

export function errorResponse(err: unknown) {
  if (err instanceof UploadError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: "Something went wrong on the server. Try again." }, 500);
}
