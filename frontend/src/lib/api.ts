import { ApiError, ApiErrorResponse, BlogPost, LocalizedBlogPost, LocalizedProductWithImage, LoginCredentials, NewBlogPost, PaginatedResponse, Product, ProductFormData, ProductWithImage, UpdateBlogPost } from '../types';
import i18n from '../i18n/config';

export const IMAGE_VARIANT_WIDTHS = [320, 640, 1024, 1600] as const;

export function getImageUrl(id: string, width?: number): string {
    return width ? `/images/${id}?w=${width}` : `/images/${id}`;
}

export function getImageSrcSet(id: string): string {
    return IMAGE_VARIANT_WIDTHS.map(w => `/images/${id}?w=${w} ${w}w`).join(', ');
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined in the environment.");
}

async function request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers);
    if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', i18n.language);
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        // Try to parse as JSON first, fall back to text if it fails
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

export const api = {
    get: (endpoint: string, options?: RequestInit) => request(endpoint, options),
    getProducts: (params?: {
        order_by?: string;
        order_direction?: string;
        in_stock?: boolean;
        product_type?: string;
        sweetness?: string;
        turbidity?: string;
        effervescence?: string;
        acidity?: string;
        tannins?: string;
        body?: string;
        page?: number;
        per_page?: number;
    }, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedProductWithImage>> => {
        const queryParams = new URLSearchParams();
        if (params) {
            if (params.order_by) queryParams.append('order_by', params.order_by);
            if (params.order_by && params.order_direction) queryParams.append('order_direction', params.order_direction);
            if (params.in_stock !== undefined) queryParams.append('in_stock', params.in_stock.toString());
            if (params.product_type) queryParams.append('product_type', params.product_type);
            if (params.sweetness) queryParams.append('sweetness', params.sweetness);
            if (params.turbidity) queryParams.append('turbidity', params.turbidity);
            if (params.effervescence) queryParams.append('effervescence', params.effervescence);
            if (params.acidity) queryParams.append('acidity', params.acidity);
            if (params.tannins) queryParams.append('tannins', params.tannins);
            if (params.body) queryParams.append('body', params.body);
            if (params.page !== undefined) queryParams.append('page', String(params.page));
            if (params.per_page !== undefined) queryParams.append('per_page', String(params.per_page));
        }
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return request(`/products${queryString}`, { signal });
    },
    getProductById: (id: string, signal?: AbortSignal): Promise<LocalizedProductWithImage> => request(`/products/${id}`, { signal }),

    adminLogin: async (credentials: LoginCredentials) => {
        return request('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
    },

    createProduct: async (productData: ProductFormData, token: string) => {
        const payload = { ...productData, image_id: productData.image_id || null };
        return request('/admin/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });
    },

    updateProduct: async (id: string, productData: Product, token: string) => {
        const payload = { ...productData, image_id: productData.image_id || null };
        return request(`/admin/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });
    },

    getProductByIdAdmin: async (id: string, token: string): Promise<ProductWithImage> => {
        return request(`/admin/products/${id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    deleteProduct: async (id: string, token: string) => {
        return request(`/admin/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    getAdminProducts: async (token: string, params?: {
        include_deleted?: 'active' | 'deleted' | 'all';
        page?: number;
        per_page?: number;
    }, signal?: AbortSignal): Promise<PaginatedResponse<ProductWithImage>> => {
        const queryParams = new URLSearchParams();
        if (params?.include_deleted) queryParams.append('include_deleted', params.include_deleted);
        if (params?.page !== undefined) queryParams.append('page', String(params.page));
        if (params?.per_page !== undefined) queryParams.append('per_page', String(params.per_page));
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return request(`/admin/products${qs}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal,
        });
    },

    restoreProduct: async (id: string, token: string): Promise<Product> => {
        return request(`/admin/products/${id}/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    hardDeleteProduct: async (id: string, token: string) => {
        return request(`/admin/products/${id}/hard`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    // Image CRUD Operations
    uploadImage: async (formData: FormData, token: string) => {
        return request('/admin/images', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
    },

    getImages: async (token: string) => {
        return request('/admin/images', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    getImageById: async (id: string, token: string) => {
        return request(`/admin/images/${id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    updateImage: async (id: string, newFileName: string, token: string) => {
        return request(`/admin/images/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ file_name: newFileName }),
        });
    },

    deleteImage: async (id: string, token: string) => {
        return request(`/admin/images/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    // Blog CRUD Operations
    getBlogPosts: (page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<LocalizedBlogPost>> => {
        const params = new URLSearchParams();
        if (page !== undefined) params.append('page', String(page));
        if (per_page !== undefined) params.append('per_page', String(per_page));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request(`/blog${qs}`, { signal });
    },
    getBlogPostBySlug: (slug: string, signal?: AbortSignal): Promise<LocalizedBlogPost> => request(`/blog/${slug}`, { signal }),
    
    // Admin blog operations
    getBlogPostsAdmin: async (token: string, page?: number, per_page?: number, signal?: AbortSignal): Promise<PaginatedResponse<BlogPost>> => {
        const params = new URLSearchParams();
        if (page !== undefined) params.append('page', String(page));
        if (per_page !== undefined) params.append('per_page', String(per_page));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request(`/admin/blog/admin${qs}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal,
        });
    },

    createBlogPost: async (postData: NewBlogPost, token: string): Promise<BlogPost> => {
        return request('/admin/blog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(postData),
        });
    },

    updateBlogPost: async (id: string, postData: UpdateBlogPost, token: string): Promise<BlogPost> => {
        return request(`/admin/blog/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(postData),
        });
    },

    deleteBlogPost: async (id: string, token: string) => {
        return request(`/admin/blog/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
};
