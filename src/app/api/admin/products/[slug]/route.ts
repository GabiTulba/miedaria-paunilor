import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;

  try {
    const results: any = await query({
      query: 'SELECT * FROM products WHERE slug = ?',
      values: [slug],
    });

    if (results.length > 0) {
      return NextResponse.json(results[0]);
    } else {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug: oldSlug } = params;
  const { name, price, description, image, slug: newSlug } = await req.json();

  if (!name || !price || !newSlug) {
    return NextResponse.json({ message: 'Name, price and slug are required' }, { status: 400 });
  }

  try {
    await query({
      query: 'UPDATE products SET name = ?, price = ?, description = ?, image = ?, slug = ? WHERE slug = ?',
      values: [name, price, description, image, newSlug, oldSlug],
    });
    return NextResponse.json({ message: 'Product updated successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;

  try {
    await query({
      query: 'DELETE FROM products WHERE slug = ?',
      values: [slug],
    });
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
