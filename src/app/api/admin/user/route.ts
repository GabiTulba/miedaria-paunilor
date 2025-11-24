import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const adminCookie = req.cookies.get('admin-token');

  if (adminCookie) {
    // In a real application, you would decode the token or fetch user details from a DB
    // For now, we'll return a static username.
    return NextResponse.json({ username: 'AdminUser' });
  } else {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
