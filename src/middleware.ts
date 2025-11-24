import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Import jwtVerify from jose

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

// Convert JWT_SECRET to a Uint8Array, as required by jose
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const adminToken = request.cookies.get('admin-token')?.value;

  // Allow access to login page without token check
  if (request.nextUrl.pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // For all other /admin routes, check for and verify token
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      // Use jose.jwtVerify to verify the token
      await jwtVerify(adminToken, encodedSecret);
      // If token is valid, proceed
      return NextResponse.next();
    } catch (error) {
      // If token is invalid, redirect to login
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
