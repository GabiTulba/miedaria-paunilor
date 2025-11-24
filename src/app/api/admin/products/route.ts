import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const products = await query({
      query: 'SELECT id, name, price, description, image, product_name FROM products',
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, price, description, image, product_name } = await req.json();

  if (!name || !price || !product_name) {
    return NextResponse.json({ message: 'Name, price and product_name are required' }, { status: 400 });
  }

  try {
    await query({
      query: 'INSERT INTO products (name, price, description, image, product_name) VALUES (?, ?, ?, ?, ?)',
      values: [name, price, description, image, product_name],
    });
    return NextResponse.json({ message: 'Product created successfully' });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { product_name: string } }) {
  const { product_name } = params;

  try {
    await query({
      query: 'DELETE FROM products WHERE product_name = ?',
      values: [product_name],
    });
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
