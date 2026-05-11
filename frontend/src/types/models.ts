// Admin-facing (full DB row) DTOs. Generated from Rust types in `backend/src/`.
// Public single-language counterparts live in `./api.public.ts`.
export type { Product } from './generated/Product';
export type { Image } from './generated/Image';
export type { BlogPost } from './generated/BlogPost';
export type { ProductWithImage } from './generated/ProductWithImage';

// Re-export here for backward compat with `from '../types'` imports;
// new code should pull from `./api.public` directly.
export type { LocalizedProduct } from './generated/LocalizedProduct';
export type { LocalizedProductWithImage } from './generated/LocalizedProductWithImage';
export type { LocalizedBlogPost } from './generated/LocalizedBlogPost';
