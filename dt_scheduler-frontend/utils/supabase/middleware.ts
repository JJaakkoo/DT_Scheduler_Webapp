import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // refreshing the auth token and fetching the user
  const { data: { user }, error } = await supabase.auth.getUser()

  const isProtectedPath = request.nextUrl.pathname.startsWith('/dashboard')
  const isAuthPage = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/auth/callback')
  
  const nexusRole = request.cookies.get('nexus_role')?.value

  // Redirect unauthenticated users trying to access protected routes
  if (isProtectedPath && (!user || error) && nexusRole !== 'guest') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    // Optional: Keep the search params or set an error state
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from the login page
  if (request.nextUrl.pathname === '/' && ((user && !error) || nexusRole === 'guest')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
