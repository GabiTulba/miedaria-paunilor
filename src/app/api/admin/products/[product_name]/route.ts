import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: { product_name: string } }) {
  const { product_name } = params;

  try {
    const results: any = await query({
      query: 'SELECT * FROM products WHERE product_name = ?',
      values: [product_name],
    });

    if (results.length > 0) {
      return NextResponse.json(results[0]);
    } else {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { product_name: string } }) {
  const { product_name: oldProduct_name } = params;
  const { name, price, description, image, product_name: newproduct_name } = await req.json();

  if (!name || !price || !newproduct_name) {
    return NextResponse.json({ message: 'Name, price and product_name are required' }, { status: 400 });
  }

  try {
    const results: ResultSetHeader = await query({
      query: 'UPDATE products SET name = ?, price = ?, description = ?, image = ?, product_name = ? WHERE product_name = ?',
      values: [name, price, description, image, newproduct_name, oldProduct_name],
    }) as ResultSetHeader;

    if (results.affectedRows === 0) {
        return NextResponse.json({ message: 'Product not found for update' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ message: 'Internal server error during update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { product_name: string } }) {
  const { product_name } = params;

  try {
    const results = await query({
      query: 'DELETE FROM products WHERE product_name = ?',
      values: [product_name],
    }) as ResultSetHeader;

    if (results.affectedRows === 0) {
      return NextResponse.json({ message: 'Product not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ message: 'Database error during deletion' }, { status: 500 });
  }
}
