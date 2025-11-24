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
      return NextResponse.json({ message: 'Login successful' });
    } else {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
