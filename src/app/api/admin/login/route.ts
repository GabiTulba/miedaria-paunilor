import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
      // In a real application, you would create a session and return a token
      const response = NextResponse.json({ message: 'Login successful' });
      response.cookies.set('admin-token', 'authenticated', { // Setting a simple token for now
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
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
