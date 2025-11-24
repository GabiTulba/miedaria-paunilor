import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { name, price, description, image, slug } = await req.json();

  if (!name || !price || !slug) {
    return NextResponse.json({ message: 'Name, price and slug are required' }, { status: 400 });
  }

  try {
    await query({
      query: 'INSERT INTO products (name, price, description, image, slug) VALUES (?, ?, ?, ?, ?)',
      values: [name, price, description, image, slug],
    });
    return NextResponse.json({ message: 'Product created successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
