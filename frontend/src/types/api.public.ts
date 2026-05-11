// Public-API DTOs returned by `/api/products`, `/api/blog`, etc. Single-language
// (Accept-Language negotiated). Admin-facing full-row DTOs live in `./models.ts`.
export type { LocalizedProduct } from './generated/LocalizedProduct';
export type { LocalizedProductWithImage } from './generated/LocalizedProductWithImage';
export type { LocalizedBlogPost } from './generated/LocalizedBlogPost';
