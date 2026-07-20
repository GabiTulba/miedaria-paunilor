import type { ApiError, ApiErrorResponse, LoginCredentials, LoginResponse, PaginatedResponse } from '../types/api';
import type { BlogPost, Product, ProductWithImage } from '../types/models';
import type { LocalizedBlogPost, LocalizedProductWithImage } from '../types/api.public';
import type { NewBlogPost, ProductFormData, UpdateBlogPost } from '../types/forms';
import type { GetProductsQuery } from '../types/generated/GetProductsQuery';
import type { GetAdminProductsQuery } from '../types/generated/GetAdminProductsQuery';
import type { MeResponse } from '../types/generated/MeResponse';
import type { AdminProductDetail } from '../types/generated/AdminProductDetail';
import type { LocalizedLot } from '../types/generated/LocalizedLot';
import type { LotNutrition } from '../types/generated/LotNutrition';
import type { CheckoutItem } from '../types/generated/CheckoutItem';
import type { CheckoutStatus } from '../types/generated/CheckoutStatus';
import type { CheckoutSessionResponse } from '../types/generated/CheckoutSessionResponse';
import type { Order } from '../types/generated/Order';
import type { OrderWithItems } from '../types/generated/OrderWithItems';
import i18n from '../i18n/config';

// Mirror of `VARIANT_WIDTHS` in backend/src/image_crud.rs.
export const IMAGE_VARIANT_WIDTHS = [320, 640, 1024, 1600] as const;

export function getImageUrl(id: string, width?: number): string {
    return width ? `/images/${id}?w=${width}` : `/images/${id}`;
}

export function getImageSrcSet(id: string): string {
    return IMAGE_VARIANT_WIDTHS.map(w => `/images/${id}?w=${w} ${w}w`).join(', ');
}

function getApiBaseUrl(): string | undefined {
    return import.meta.env.VITE_API_BASE_URL as string | undefined;
}

// Build a `?k=v&...` string from a record. Skips undefined/null/empty-string entries
// so callers can pass the entire param object without per-field guards.
function buildQuery(params: Record<string, unknown> | undefined): string {
    if (!params) return '';
    const qp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        qp.append(key, typeof value === 'string' ? value : String(value));
    }
    const qs = qp.toString();
    return qs ? `?${qs}` : '';
}

// 1 kcal = 4.184 kJ (EU labelling conversion factor).
const KCAL_TO_KJ = 4.184;

function normalizeProductPayload(productData: ProductFormData | (Product & LotNutrition)) {
    return {
        ...productData,
        image_id: productData.image_id || null,
        // The form only asks for kcal; kJ is derived here, rounded to the one
        // decimal the backend stores (DECIMAL(6,1)).
        energy_kj: Math.round(productData.energy_kcal * KCAL_TO_KJ * 10) / 10,
    };
}

async function request(endpoint: string, options: RequestInit = {}) {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
        const error = new Error("VITE_API_BASE_URL is not defined in the environment.") as ApiError;
        error.response = { status: 0, data: { message: 'API not configured' } };
        throw error;
    }
    const url = `${baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', i18n.language);
    }
    // The httpOnly admin_session cookie is scoped to /api/admin. Send it
    // automatically on every admin call so individual callers don't need to
    // know about the session.
    const credentials: RequestCredentials | undefined =
        options.credentials ?? (endpoint.startsWith('/admin') ? 'include' : undefined);
    const response = await fetch(url, { ...options, headers, credentials });
    if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorBody: ApiErrorResponse;
        if (contentType && contentType.includes('application/json')) {
            errorBody = await response.json() as ApiErrorResponse;
        } else {
            const text = await response.text();
            errorBody = { message: text || 'Network response was not ok' };
        }
        const error = new Error(errorBody.message || 'An error occurred') as ApiError;
        error.response = {
            status: response.status,
            data: errorBody,
        };
        throw error;
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

// Re-export the generated types under their old FE-local names for backward compat.
export type GetProductsParams = GetProductsQuery;
export type GetAdminProductsParams = GetAdminProductsQuery;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export const api = {
    get: (endpoint: string, options?: RequestInit) => request(endpoint, options),
    getProducts: (params?: GetProductsParams, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedProductWithImage>> => {
        // order_direction only meaningful when order_by is set; drop the orphan.
        const cleaned: Record<string, unknown> = { ...params };
        if (!cleaned.order_by) delete cleaned.order_direction;
        return request(`/products${buildQuery(cleaned)}`, { signal });
    },
    getProductById: (id: string, signal?: AbortSignal): Promise<LocalizedProductWithImage> => request(`/products/${id}`, { signal }),
    getLot: (lotNumber: string, signal?: AbortSignal): Promise<LocalizedLot> => request(`/lots/${lotNumber}`, { signal }),

    // Starts a Stripe Checkout Session; the returned url is Stripe-hosted and
    // the browser should be redirected there. Prices are recomputed server-side.
    createCheckoutSession: (items: CheckoutItem[]): Promise<CheckoutSessionResponse> => {
        return request('/checkout/session', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ items }),
        });
    },

    getCheckoutStatus: (signal?: AbortSignal): Promise<CheckoutStatus> => {
        return request('/checkout/status', { signal });
    },

    setCheckoutEnabled: (enabled: boolean): Promise<CheckoutStatus> => {
        return request('/admin/settings/checkout', {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ enabled }),
        });
    },

    getAdminOrders: (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<Order>> => {
        return request(`/admin/orders${buildQuery({ page, per_page })}`, { signal });
    },

    getAdminOrder: (id: string, signal?: AbortSignal): Promise<OrderWithItems> => {
        return request(`/admin/orders/${id}`, { signal });
    },

    adminLogin: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        return request('/admin/login', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(credentials),
        });
    },

    adminLogout: async (): Promise<void> => {
        await request('/admin/logout', { method: 'POST' });
    },

    adminMe: async (signal?: AbortSignal): Promise<MeResponse> => {
        return request('/admin/me', { signal });
    },

    createProduct: async (productData: ProductFormData) => {
        return request('/admin/products', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(normalizeProductPayload(productData)),
        });
    },

    updateProduct: async (id: string, productData: ProductFormData) => {
        return request(`/admin/products/${id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify(normalizeProductPayload(productData)),
        });
    },

    getProductByIdAdmin: async (id: string, signal?: AbortSignal): Promise<AdminProductDetail> => {
        return request(`/admin/products/${id}`, { method: 'GET', signal });
    },

    deleteProduct: async (id: string) => {
        return request(`/admin/products/${id}`, { method: 'DELETE' });
    },

    getAdminProducts: async (params?: GetAdminProductsParams, signal?: AbortSignal): Promise<PaginatedResponse<ProductWithImage>> => {
        return request(`/admin/products${buildQuery(params as Record<string, unknown> | undefined)}`, {
            method: 'GET',
            signal,
        });
    },

    restoreProduct: async (id: string): Promise<Product> => {
        return request(`/admin/products/${id}/restore`, { method: 'POST' });
    },

    hardDeleteProduct: async (id: string) => {
        return request(`/admin/products/${id}/hard`, { method: 'DELETE' });
    },

    // Image CRUD Operations
    uploadImage: async (formData: FormData) => {
        return request('/admin/images', {
            method: 'POST',
            body: formData,
        });
    },

    getImages: async () => {
        return request('/admin/images', { method: 'GET' });
    },

    updateImage: async (id: string, newFileName: string) => {
        return request(`/admin/images/${id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ file_name: newFileName }),
        });
    },

    deleteImage: async (id: string) => {
        return request(`/admin/images/${id}`, { method: 'DELETE' });
    },

    // Blog CRUD Operations
    getBlogPosts: (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedBlogPost>> => {
        return request(`/blog${buildQuery({ page, per_page })}`, { signal });
    },
    getBlogPostBySlug: (slug: string, signal?: AbortSignal): Promise<LocalizedBlogPost> => request(`/blog/${slug}`, { signal }),

    // Admin blog operations
    getBlogPostsAdmin: async (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<BlogPost>> => {
        return request(`/admin/blog/admin${buildQuery({ page, per_page })}`, {
            method: 'GET',
            signal,
        });
    },

    getBlogPostByIdAdmin: async (id: string, signal?: AbortSignal): Promise<BlogPost> => {
        return request(`/admin/blog/${id}`, {
            method: 'GET',
            signal,
        });
    },

    createBlogPost: async (postData: NewBlogPost): Promise<BlogPost> => {
        return request('/admin/blog', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(postData),
        });
    },

    updateBlogPost: async (id: string, postData: UpdateBlogPost): Promise<BlogPost> => {
        return request(`/admin/blog/${id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify(postData),
        });
    },

    deleteBlogPost: async (id: string) => {
        return request(`/admin/blog/${id}`, { method: 'DELETE' });
    },
};
