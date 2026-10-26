import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

// A page found no valid session behind the cookie (expired, revoked, role changed, deactivated).
// Pages can't clear cookies while rendering, so they send the browser here first.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/sign-in?expired=1", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
