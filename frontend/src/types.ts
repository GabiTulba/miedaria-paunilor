export interface Image {
  id: string; // UUID as string
  file_name: string;
  storage_path: string;
  created_at: string; // NaiveDateTime as string
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
  tanins: string;
  body: string;
  abv: number | string; // Decimal as number or string
  bottle_count: number;
  bottle_size: number;
  price: number | string; // Decimal as number or string
  price_ron: number | string; // Decimal as number or string
  image_id: string; // Reference to Image.id
}

export interface ProductWithImage {
  product: Product;
  image: Image | null;
}

export interface BlogPost {
  id: string; // UUID as string
  title: string;
  title_ro: string;
  blog_id: string;
  content_markdown: string;
  content_markdown_ro: string;
  excerpt: string;
  excerpt_ro: string;
  author: string;
  published_at: string; // NaiveDateTime as string
  updated_at: string; // NaiveDateTime as string
  is_published: boolean;
}

export interface NewBlogPost {
  title: string;
  title_ro: string;
  blog_id: string;
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
  blog_id?: string;
  content_markdown?: string;
  content_markdown_ro?: string;
  excerpt?: string;
  excerpt_ro?: string;
  author?: string;
  is_published?: boolean;
}