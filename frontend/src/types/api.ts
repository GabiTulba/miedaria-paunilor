// Wire-level request/response shapes used by the API client (FE-only — these
// describe browser/fetch behavior, not the BE wire format).
export type { PaginatedResponse } from './generated/PaginatedResponse';
export type { LoginCredentials } from './generated/LoginCredentials';
export type { LoginResponse } from './generated/LoginResponse';

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
