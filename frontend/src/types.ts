export interface Image {
  id: string; // UUID as string
  file_name: string;
  storage_path: string;
  created_at: string; // Timestamptz as string
  file_size: number;
}

export interface Product {
  product_id: string;
  product_name: string;
  product_name_ro: string;
  product_description: string;
  product_description_ro: string;
  ingredients: string;
  ingredients_ro: string;
  product_type: string;
  sweetness: string;

  turbidity: string;
  effervescence: string;
  acidity: string;
  tannins: string;
  body: string;
  abv: number | string; // Decimal as number or string
  bottle_count: number;
  bottle_size: number;
  price: number | string; // Decimal as number or string
  price_ron: number | string; // Decimal as number or string
  image_id: string | null; // Reference to Image.id, nullable
  bottling_date: string; // Date in ISO format (YYYY-MM-DD)
  lot_number: number; // Positive integer
  updated_at: string; // Timestamptz as string
  deleted_at: string | null; // Timestamptz as string, null if active
}

export interface ProductWithImage {
  product: Product;
  image: Image | null;
}

export interface BlogPost {
  id: string; // UUID as string
  title: string;
  title_ro: string;
  slug: string;
  content_markdown: string;
  content_markdown_ro: string;
  excerpt: string;
  excerpt_ro: string;
  author: string;
  published_at: string | null; // Timestamptz as string, null for drafts
  updated_at: string; // Timestamptz as string
  is_published: boolean;
}

export interface NewBlogPost {
  title: string;
  title_ro: string;
  slug: string;
  content_markdown: string;
  content_markdown_ro: string;
  excerpt: string;
  excerpt_ro: string;
  author: string;
  is_published: boolean;
}

export interface UpdateBlogPost {
  title?: string;
  title_ro?: string;
  slug?: string;
  content_markdown?: string;
  content_markdown_ro?: string;
  excerpt?: string;
  excerpt_ro?: string;
  author?: string;
  is_published?: boolean;
}

export type ProductFormData = Omit<Product, 'product_id' | 'updated_at' | 'deleted_at'> & { product_id?: string };

// Localized types — returned by public API endpoints (single-language, Accept-Language driven)
export interface LocalizedProduct {
  product_id: string;
  product_name: string;
  product_description: string;
  ingredients: string;
  product_type: string;
  sweetness: string;
  turbidity: string;
  effervescence: string;
  acidity: string;
  tannins: string;
  body: string;
  abv: number | string;
  bottle_count: number;
  bottle_size: number;
  price: number | string;
  currency: string;
  image_id: string | null;
  bottling_date: string;
  lot_number: number;
}

export interface LocalizedProductWithImage {
  product: LocalizedProduct;
  image: Image | null;
}

export interface LocalizedBlogPost {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  excerpt: string;
  author: string;
  published_at: string | null;
  updated_at: string;
  is_published: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ApiErrorResponse {
  message?: string;
  errors?: string[];
}

export interface ApiError extends Error {
  response: {
    status: number;
    data: ApiErrorResponse;
  };
}
