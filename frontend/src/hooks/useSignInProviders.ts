import { useFetch } from './useFetch';
import { api } from '../lib/api';

/// Which third-party sign-ins the backend has enabled.
export function useSignInProviders() {
    const { data } = useFetch(signal => api.getSignInProviders(signal), []);
    return { google: data?.google ?? false };
}
