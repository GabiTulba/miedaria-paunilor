import { BlogPost, NewBlogPost, Product, ProductWithImage, UpdateBlogPost } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined in the environment.");
}

async function request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, options);
    if (!response.ok) {
        // Try to parse as JSON first, fall back to text if it fails
        const contentType = response.headers.get('content-type');
        let errorBody;
        if (contentType && contentType.includes('application/json')) {
            errorBody = await response.json();
        } else {
            const text = await response.text();
            errorBody = { message: text || 'Network response was not ok' };
        }
        const error: any = new Error(errorBody.message || 'An error occurred');
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
    get: (endpoint: string) => request(endpoint),
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
        limit?: number;
    }): Promise<ProductWithImage[]> => {
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
            if (params.limit !== undefined) queryParams.append('limit', String(params.limit));
        }
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return request(`/products${queryString}`);
    },
    getProductById: (id: string): Promise<ProductWithImage> => request(`/products/${id}`),

    adminLogin: async (credentials: any) => {
        return request('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
    },

    createProduct: async (productData: any, token: string) => {
        return request('/admin/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData),
        });
    },

    updateProduct: async (id: string, productData: Product, token: string) => {
        return request(`/admin/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData),
        });
    },

    deleteProduct: async (id: string, token: string) => {
        return request(`/admin/products/${id}`, {
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
    getBlogPosts: (page?: number, per_page?: number, limit?: number): Promise<BlogPost[]> => {
        const params = new URLSearchParams();
        if (page !== undefined) params.append('page', String(page));
        if (per_page !== undefined) params.append('per_page', String(per_page));
        if (limit !== undefined) params.append('limit', String(limit));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request(`/blog${qs}`);
    },
    getBlogPostByBlogId: (blog_id: string): Promise<BlogPost> => request(`/blog/${blog_id}`),
    
    // Admin blog operations
    getBlogPostsAdmin: async (token: string, page?: number, per_page?: number, limit?: number): Promise<BlogPost[]> => {
        const params = new URLSearchParams();
        if (page !== undefined) params.append('page', String(page));
        if (per_page !== undefined) params.append('per_page', String(per_page));
        if (limit !== undefined) params.append('limit', String(limit));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request(`/admin/blog/admin${qs}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
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
