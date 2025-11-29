export async function fetchWithAuth(url: string, token: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    // For DELETE requests, there might not be a body
    if (response.status === 204) {
        return;
    }

    return response.json();
}
