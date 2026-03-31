import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname.startsWith("/api/cron")) return NextResponse.next();
  if (pathname === "/login") return NextResponse.next();
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/projects/:path*",
    "/admin/:path*",
    "/api/projects/:path*",
    "/api/admin/:path*",
  ],
};
