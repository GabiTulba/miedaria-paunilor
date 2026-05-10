// Mirror of caps in backend/src/blog_crud.rs (search for `> 512`, `> 1024`, `> 256`).
// Surfaced on the frontend as `maxLength` so the UI rejects over-long input before
// the backend rejects it on submit.
export const BLOG_TITLE_MAX = 512;
export const BLOG_EXCERPT_MAX = 1024;
export const BLOG_AUTHOR_MAX = 256;
export const BLOG_SLUG_MAX = 256;
