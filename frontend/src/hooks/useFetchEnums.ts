import { useContext } from 'react';
import { EnumContext } from '../context/EnumContext';
import { EnumValues } from '../enums';

interface UseFetchEnumsResult {
    enums: EnumValues | null;
    loading: boolean;
    error: string | null;
}

export function useFetchEnums(): UseFetchEnumsResult {
    const { enums, loading, error } = useContext(EnumContext);
    return { enums, loading, error };
}
