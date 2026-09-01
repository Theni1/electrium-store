import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (!sessionId) {
    return NextResponse.redirect(`${origin}/cart`);
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("cart_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("status", "active")
    .maybeSingle();

  if (session) {
    const cookieStore = await cookies();
    cookieStore.set("cart_session_id", session.id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return NextResponse.redirect(`${origin}/cart`);
}
