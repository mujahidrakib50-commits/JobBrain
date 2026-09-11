import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("jobbrain_session")?.value;

  const isAuthPage = pathname === "/auth" || pathname.startsWith("/auth/");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApi =
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/gmail/callback") ||
    pathname.startsWith("/api/uploads/");

  // 1. If user is logged in and trying to access /auth, redirect to dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. If user is not logged in:
  if (!token) {
    // For protected API endpoints, return 401 Unauthorized immediately
    if (isApiRoute && !isPublicApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For protected pages (like /), redirect to /auth
    if (!isAuthPage && !isApiRoute) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - images, fonts and other static media
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)",
  ],
};
