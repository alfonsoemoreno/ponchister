import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // YouTube rejects embedded playback from the numeric loopback origin.
  // Keep the real browser origin and the player's origin aligned on localhost.
  const host = request.headers.get("host")?.split(":")[0];
  if (process.env.NODE_ENV === "development" && host === "127.0.0.1") {
    const destination = request.nextUrl.clone();
    destination.hostname = "localhost";
    return NextResponse.redirect(destination, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
