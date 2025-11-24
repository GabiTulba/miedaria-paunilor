import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Import jwtVerify from jose

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

// Convert JWT_SECRET to a Uint8Array, as required by jose
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
  const adminToken = req.cookies.get('admin-token')?.value;

  if (!adminToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use jose.jwtVerify to verify the token
    const { payload } = await jwtVerify(adminToken, encodedSecret);
    return NextResponse.json({ username: payload.username });
  } catch (error) {
    console.error('Failed to decode token:', error);
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
