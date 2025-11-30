import { Product } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

async function request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network response was not ok' }));
        throw new Error(error.message || 'An error occurred');
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

export const api = {
    getProducts: (): Promise<Product[]> => request('/products'),
    getProductById: (id: string): Promise<Product> => request(`/products/${id}`),

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

    updateProduct: async (id: string, productData: any, token: string) => {
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
};
