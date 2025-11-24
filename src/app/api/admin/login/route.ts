import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SignJWT } from 'jose'; // Import SignJWT from jose

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

// Convert JWT_SECRET to a Uint8Array, as required by jose
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
  }

  try {
    const results: any = await query({
      query: 'SELECT * FROM users WHERE username = ? AND password = ?',
      values: [username, password],
    });

    if (results.length > 0) {
      // Use jose.SignJWT to generate a JWT token
      const token = await new SignJWT({ username: results[0].username })
        .setProtectedHeader({ alg: 'HS256' }) // Specify the algorithm
        .setIssuedAt()
        .setExpirationTime('1d') // 1 day expiration
        .sign(encodedSecret);

      const response = NextResponse.json({ message: 'Login successful' });
      response.cookies.set('admin-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
