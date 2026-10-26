import type { Role } from "../constants";

// Where each role lands after sign-in (WebSignIn: "Where you'll land") and the URL area it owns.
export const LANDING: Record<Role, string> = {
  admin: "/admin",
  validator: "/validator",
  player: "/player",
  contributor: "/contribute",
};

/** Pages for signed-out visitors; a signed-in visitor is sent to their landing page instead. */
export const GUEST_ONLY = ["/sign-in", "/sign-up"];

/** Pages anyone may open, signed in or not. */
export const PUBLIC = ["/forgot-password", "/reset-password", "/ui"];

/** Signed-in pages every role may open. */
export const ANY_ROLE = ["/account"];

export function areaOf(pathname: string): Role | null {
  for (const [role, prefix] of Object.entries(LANDING) as [Role, string][]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

export function matches(pathname: string, list: string[]) {
  return list.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
