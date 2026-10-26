import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionCookie, SESSION_COOKIE } from "@/lib/auth/cookie";
import { ANY_ROLE, areaOf, GUEST_ONLY, LANDING, matches } from "@/lib/auth/routes";

// Optimistic routing from the signed cookie alone (no database): send people to the right place fast.
// The real check is requireAccount() in every page and action.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = decodeSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (pathname === "/") return to(session ? LANDING[session.role] : "/sign-in");

  if (matches(pathname, GUEST_ONLY)) return session ? to(LANDING[session.role]) : NextResponse.next();

  const area = areaOf(pathname);
  if (area || matches(pathname, ANY_ROLE)) {
    if (!session) return to(`/sign-in?next=${encodeURIComponent(pathname + search)}`);
    if (area && area !== session.role) return to(LANDING[session.role]);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static files, images and API routes (the game API authenticates itself).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
