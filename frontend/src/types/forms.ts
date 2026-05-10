// Form-only shapes used by admin form pages.
import { Product } from './models';

export type ProductFormData = Omit<Product, 'product_id' | 'updated_at' | 'deleted_at'> & { product_id?: string };

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
