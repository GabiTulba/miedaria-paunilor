import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const products = await query({
      query: `SELECT 
                id, name, product_name, description, image, 
                size, price, availability, 
                organoleptic, taste, smell, body, alcohol, ingredients 
              FROM products`,
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { 
    name, product_name, description, image, 
    size, price, availability, 
    organoleptic, taste, smell, body, alcohol, ingredients 
  } = await req.json();

  if (!name || !price || !product_name || !size || !availability || !alcohol) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  try {
    await query({
      query: `INSERT INTO products (
                name, product_name, description, image, 
                size, price, availability, 
                organoleptic, taste, smell, body, alcohol, ingredients
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        name, product_name, description, image, 
        size, price, availability, 
        organoleptic, taste, smell, body, alcohol, ingredients
      ],
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
