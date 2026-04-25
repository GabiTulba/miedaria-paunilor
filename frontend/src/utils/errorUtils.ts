import { ApiError } from '../types';

export type ErrorCategory = 'notFound' | 'serverError' | 'networkError' | 'unauthorized' | 'forbidden' | 'validationError';

export interface CategorizedError {
  category: ErrorCategory;
  messageKey: string;
  statusCode?: number;
}

export function categorizeError(err: unknown): CategorizedError {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return { category: 'networkError', messageKey: 'errors.networkError' };
  }

  const apiError = err as ApiError;
  if (apiError?.response?.status) {
    const status = apiError.response.status;
    if (status === 401) return { category: 'unauthorized', messageKey: 'errors.unauthorized', statusCode: status };
    if (status === 403) return { category: 'forbidden', messageKey: 'errors.forbidden', statusCode: status };
    if (status === 404) return { category: 'notFound', messageKey: 'errors.notFound', statusCode: status };
    if (status === 422) return { category: 'validationError', messageKey: 'errors.validationError', statusCode: status };
    if (status >= 500) return { category: 'serverError', messageKey: 'errors.serverError', statusCode: status };
  }

  return { category: 'serverError', messageKey: 'errors.serverError' };
}
