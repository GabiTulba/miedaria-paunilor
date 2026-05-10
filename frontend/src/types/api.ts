// Request/response shapes used by the API client (independent of the DB models).

export interface PaginatedResponse<T> {
  items: T[];
  total_pages: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ApiErrorResponse {
  message?: string;
  errors?: string[];
}

export interface ApiError extends Error {
  response: {
    status: number;
    data: ApiErrorResponse;
  };
}
