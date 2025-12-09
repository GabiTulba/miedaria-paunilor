import { Product, ProductWithImage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined in the environment.");
}

async function request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Network response was not ok' }));
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
    getProducts: (): Promise<ProductWithImage[]> => request('/products'),
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
        return request(`/api/admin/products/${id}`, {
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
};
