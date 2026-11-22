import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname.startsWith("/login");
  const isLanding = pathname === "/";
  const isAuthRoute = pathname.startsWith("/auth/");

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    if (isLanding || isLogin || isAuthRoute) return response;
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  const { data: profile } = await supabase.from("user_akun")
    .select("aktif,must_change_password").eq("id", userId).maybeSingle();

  if (!profile?.aktif) {
    await supabase.auth.signOut();
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  if (profile.must_change_password && !isLogin && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isLogin && !profile.must_change_password) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
