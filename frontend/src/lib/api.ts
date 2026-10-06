import type { ApiError, ApiErrorResponse, LoginCredentials, LoginResponse, PaginatedResponse } from '../types/api';
import type { BlogPost, Product, ProductWithImage } from '../types/models';
import type { LocalizedBlogPost, LocalizedProductWithImage } from '../types/api.public';
import type { NewBlogPost, ProductFormData, UpdateBlogPost } from '../types/forms';
import type { GetProductsQuery } from '../types/generated/GetProductsQuery';
import type { GetAdminProductsQuery } from '../types/generated/GetAdminProductsQuery';
import type { MeResponse } from '../types/generated/MeResponse';
import type { AdminProductDetail } from '../types/generated/AdminProductDetail';
import type { LocalizedLot } from '../types/generated/LocalizedLot';
import type { ExchangeRateInfo } from '../types/generated/ExchangeRateInfo';
import type { LotNutrition } from '../types/generated/LotNutrition';
import type { CheckoutSessionRequest } from '../types/generated/CheckoutSessionRequest';
import type { ShippingOptions } from '../types/generated/ShippingOptions';
import type { ShippingRate } from '../types/generated/ShippingRate';
import type { Shipment } from '../types/generated/Shipment';
import type { CreateShipmentRequest } from '../types/generated/CreateShipmentRequest';
import type { CheckoutStatus } from '../types/generated/CheckoutStatus';
import type { CheckoutSessionResponse } from '../types/generated/CheckoutSessionResponse';
import type { Order } from '../types/generated/Order';
import type { OrderWithItems } from '../types/generated/OrderWithItems';
import type { NewsletterStats } from '../types/generated/NewsletterStats';
import type { NotifySubscribersResponse } from '../types/generated/NotifySubscribersResponse';
import type { StockLevel } from '../types/generated/StockLevel';
import type { AccountProfile } from '../types/generated/AccountProfile';
import type { SignInProviders } from '../types/generated/SignInProviders';
import type { AccountOrder } from '../types/generated/AccountOrder';
import type { AccountOrderWithItems } from '../types/generated/AccountOrderWithItems';
import type { SiteEvent } from '../types/generated/SiteEvent';
import type { LabelSize } from '../types/generated/LabelSize';
import type { LabelPreview } from '../types/generated/LabelPreview';
import type { LabelPreviewRequest } from '../types/generated/LabelPreviewRequest';
import type { LabelBundleRequest } from '../types/generated/LabelBundleRequest';
import i18n from '../i18n/config';

// Mirror of `VARIANT_WIDTHS` in backend/src/image_crud.rs.
export const IMAGE_VARIANT_WIDTHS = [320, 640, 1024, 1600] as const;

export function getImageUrl(id: string, width?: number): string {
    return width ? `/images/${encodeURIComponent(id)}?w=${width}` : `/images/${encodeURIComponent(id)}`;
}

export function getImageSrcSet(id: string): string {
    return IMAGE_VARIANT_WIDTHS.map(w => `/images/${encodeURIComponent(id)}?w=${w} ${w}w`).join(', ');
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

async function apiError(response: Response): Promise<ApiError> {
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
    return error;
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
        throw await apiError(response);
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

function postJson(endpoint: string, body: unknown) {
    return request(endpoint, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}

function deleteJson(endpoint: string, body: unknown) {
    return request(endpoint, { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify(body) });
}

// Every id/slug interpolated into a path below goes through encodeURIComponent:
// route params come from the address bar, and an unencoded `../` would let a
// crafted link point the request at a different API endpoint.

export const api = {
    get: (endpoint: string, options?: RequestInit) => request(endpoint, options),
    getProducts: (params?: GetProductsParams, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedProductWithImage>> => {
        // order_direction only meaningful when order_by is set; drop the orphan.
        const cleaned: Record<string, unknown> = { ...params };
        if (!cleaned.order_by) delete cleaned.order_direction;
        return request(`/products${buildQuery(cleaned)}`, { signal });
    },
    getProductById: (id: string, signal?: AbortSignal): Promise<LocalizedProductWithImage> => request(`/products/${encodeURIComponent(id)}`, { signal }),
    getLot: (lotNumber: string, signal?: AbortSignal): Promise<LocalizedLot> => request(`/lots/${encodeURIComponent(lotNumber)}`, { signal }),
    // BNR rate used for indicative EUR display; null until the first fetch.
    getExchangeRate: (signal?: AbortSignal): Promise<ExchangeRateInfo | null> => request('/exchange-rate', { signal }),

    // Starts a Stripe Checkout Session; the returned url is Stripe-hosted and
    // the browser should be redirected there. Prices are recomputed server-side.
    createCheckoutSession: (checkout: CheckoutSessionRequest): Promise<CheckoutSessionResponse> =>
        postJson('/checkout/session', checkout),

    getShippingOptions: (signal?: AbortSignal): Promise<ShippingOptions> => request('/shipping/options', { signal }),

    // Releases the stock held by a checkout the customer left without paying.
    // Safe to call for any order: the server ignores orders no longer pending.
    cancelCheckout: (orderId: string): Promise<null> => {
        return request('/checkout/cancel', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ order_id: orderId }),
            keepalive: true,
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
        return request(`/admin/orders/${encodeURIComponent(id)}`, { signal });
    },

    getShippingRates: (signal?: AbortSignal): Promise<ShippingRate[]> => request('/admin/shipping/rates', { signal }),

    updateShippingRate: (rate: ShippingRate): Promise<ShippingRate[]> =>
        request('/admin/shipping/rates', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(rate) }),

    // Suggested parcel weight in grams, from the products' packed weights.
    getShipmentWeight: (orderId: string, signal?: AbortSignal): Promise<number> =>
        request(`/admin/orders/${encodeURIComponent(orderId)}/awb/weight`, { signal }),

    createShipment: (orderId: string, shipment: CreateShipmentRequest): Promise<Shipment> =>
        postJson(`/admin/orders/${encodeURIComponent(orderId)}/awb`, shipment),

    cancelShipment: (orderId: string): Promise<null> =>
        request(`/admin/orders/${encodeURIComponent(orderId)}/awb`, { method: 'DELETE' }),

    // Fetched with the admin cookie and handed to the browser as a download.
    getLabelSizes: (signal?: AbortSignal): Promise<LabelSize[]> => request('/admin/labels/sizes', { signal }),
    previewLabels: (body: LabelPreviewRequest, signal?: AbortSignal): Promise<LabelPreview> =>
        request('/admin/labels/preview', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body), signal }),
    // A ZIP of every label, print layer and A4 sheet; a refusal is thrown with
    // the renderer's `LabelError` as its response data.
    downloadLabelBundle: async (body: LabelBundleRequest): Promise<Blob> => {
        const response = await fetch(`${getApiBaseUrl()}/admin/labels/bundle`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(body),
            credentials: 'include',
        });
        if (!response.ok) {
            throw await apiError(response);
        }
        return response.blob();
    },
    downloadShipmentLabel: async (orderId: string): Promise<Blob> => {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/admin/orders/${encodeURIComponent(orderId)}/awb/label`, {
            credentials: 'include',
        });
        if (!response.ok) {
            const error = new Error('Could not download the label') as ApiError;
            error.response = { status: response.status, data: { message: 'Could not download the label' } };
            throw error;
        }
        return response.blob();
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
        return request(`/admin/products/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify(normalizeProductPayload(productData)),
        });
    },

    getProductByIdAdmin: async (id: string, signal?: AbortSignal): Promise<AdminProductDetail> => {
        return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'GET', signal });
    },

    // Signed change to sellable stock (e.g. +24 for a new case). Stock is never
    // written by updateProduct, so a stale edit form can't overwrite sales.
    adjustStock: async (id: string, delta: number): Promise<StockLevel> => {
        return request(`/admin/products/${encodeURIComponent(id)}/stock`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ delta }),
        });
    },

    deleteProduct: async (id: string) => {
        return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    getAdminProducts: async (params?: GetAdminProductsParams, signal?: AbortSignal): Promise<PaginatedResponse<ProductWithImage>> => {
        return request(`/admin/products${buildQuery(params as Record<string, unknown> | undefined)}`, {
            method: 'GET',
            signal,
        });
    },

    restoreProduct: async (id: string): Promise<Product> => {
        return request(`/admin/products/${encodeURIComponent(id)}/restore`, { method: 'POST' });
    },

    hardDeleteProduct: async (id: string) => {
        return request(`/admin/products/${encodeURIComponent(id)}/hard`, { method: 'DELETE' });
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
        return request(`/admin/images/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ file_name: newFileName }),
        });
    },

    deleteImage: async (id: string) => {
        return request(`/admin/images/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    // Blog CRUD Operations
    getBlogPosts: (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedBlogPost>> => {
        return request(`/blog${buildQuery({ page, per_page })}`, { signal });
    },
    getBlogPostBySlug: (slug: string, signal?: AbortSignal): Promise<LocalizedBlogPost> => request(`/blog/${encodeURIComponent(slug)}`, { signal }),

    // Admin blog operations
    getBlogPostsAdmin: async (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<BlogPost>> => {
        return request(`/admin/blog/admin${buildQuery({ page, per_page })}`, {
            method: 'GET',
            signal,
        });
    },

    getBlogPostByIdAdmin: async (id: string, signal?: AbortSignal): Promise<BlogPost> => {
        return request(`/admin/blog/${encodeURIComponent(id)}`, {
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
        return request(`/admin/blog/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify(postData),
        });
    },

    deleteBlogPost: async (id: string) => {
        return request(`/admin/blog/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    notifyBlogSubscribers: (id: string, resend: boolean): Promise<NotifySubscribersResponse> => {
        return request(`/admin/blog/${encodeURIComponent(id)}/notify`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ resend }),
        });
    },

    // Newsletter
    subscribeNewsletter: (email: string): Promise<null> => {
        return request('/newsletter/subscribe', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ email }),
        });
    },

    confirmNewsletter: (token: string): Promise<null> => {
        return request('/newsletter/confirm', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ token }),
        });
    },

    unsubscribeNewsletter: (id: string, token: string): Promise<null> => {
        return request(`/newsletter/unsubscribe${buildQuery({ id, token })}`, { method: 'POST' });
    },

    // Anonymous site statistics; keepalive lets an event outlive the page.
    recordEvent: (event: SiteEvent): Promise<null> => {
        return request('/events', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(event),
            keepalive: true,
        });
    },

    getNewsletterStats: (signal?: AbortSignal): Promise<NewsletterStats> => {
        return request('/admin/newsletter/stats', { signal });
    },

    // Customer accounts. The session lives in an httpOnly same-origin cookie,
    // sent by default (credentials: 'same-origin').
    accountMe: (signal?: AbortSignal): Promise<AccountProfile | null> => request('/account/me', { signal }),
    accountRegister: (email: string): Promise<null> => postJson('/account/register', { email }),
    accountRequestPasswordReset: (email: string): Promise<null> => postJson('/account/password-reset', { email }),
    accountSetPassword: (token: string, password: string): Promise<AccountProfile> =>
        postJson('/account/set-password', { token, password }),
    accountLogin: (email: string, password: string): Promise<AccountProfile> =>
        postJson('/account/login', { email, password }),
    accountLogout: (): Promise<null> => request('/account/logout', { method: 'POST' }),
    accountLogoutEverywhere: (): Promise<null> => request('/account/logout-all', { method: 'POST' }),
    accountChangeEmail: (newEmail: string, currentPassword?: string): Promise<null> =>
        postJson('/account/email', { new_email: newEmail, current_password: currentPassword }),
    accountConfirmEmailChange: (token: string): Promise<null> => postJson('/account/email/confirm', { token }),
    accountChangePassword: (currentPassword: string, newPassword: string): Promise<null> =>
        postJson('/account/password', { current_password: currentPassword, new_password: newPassword }),
    getAccountOrders: (page?: number, signal?: AbortSignal): Promise<PaginatedResponse<AccountOrder>> =>
        request(`/account/orders${buildQuery({ page })}`, { signal }),
    getAccountOrder: (id: string, signal?: AbortSignal): Promise<AccountOrderWithItems> =>
        request(`/account/orders/${encodeURIComponent(id)}`, { signal }),
    // `currentPassword` is omitted by accounts without a password, which
    // confirm by signing in with Google again (see googleSignInUrl).
    accountExport: (currentPassword?: string): Promise<unknown> =>
        postJson('/account/export', { current_password: currentPassword }),
    deleteAccount: (currentPassword?: string): Promise<null> =>
        deleteJson('/account', { current_password: currentPassword }),
    getSignInProviders: (signal?: AbortSignal): Promise<SignInProviders> => request('/account/providers', { signal }),
    unlinkGoogle: (currentPassword: string): Promise<null> =>
        deleteJson('/account/google', { current_password: currentPassword }),
};

export type GoogleIntent = 'sign-in' | 'link' | 'reauth';

/// Page navigation (not fetch) that starts a Google sign-in; the backend
/// redirects to Google and back to `next` on this site.
export function googleSignInUrl(intent: GoogleIntent, lang: string, next: string): string {
    return `${getApiBaseUrl() ?? ''}/account/google/start${buildQuery({ intent, lang, next })}`;
}
