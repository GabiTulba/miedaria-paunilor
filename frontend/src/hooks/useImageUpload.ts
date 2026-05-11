import { useCallback, useState } from 'react';
import { Image } from '../types';

interface UseImageUploadResult {
    progress: number | null;
    uploading: boolean;
    upload: (file: File) => Promise<Image | null>;
}

interface UseImageUploadOptions {
    onError: (message: string) => void;
}

// Wraps the XMLHttpRequest plumbing needed to track upload progress (fetch can't
// stream upload progress in browsers). Resolves to the parsed Image on success
// and `null` on failure (the caller has already been notified via onError).
export function useImageUpload({ onError }: UseImageUploadOptions): UseImageUploadResult {
    const [progress, setProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);

    const upload = useCallback((file: File) => {
        return new Promise<Image | null>((resolve) => {
            const baseUrl = import.meta.env.VITE_API_BASE_URL;
            if (!baseUrl) {
                onError('API not configured');
                resolve(null);
                return;
            }

            setUploading(true);
            setProgress(0);

            const formData = new FormData();
            formData.append('image', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${baseUrl}/admin/images`);
            // Ship the httpOnly admin_session cookie alongside the upload.
            xhr.withCredentials = true;

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                setUploading(false);
                setProgress(null);
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText) as Image);
                    } catch {
                        onError('Invalid server response');
                        resolve(null);
                    }
                } else {
                    try {
                        const body = JSON.parse(xhr.responseText);
                        onError(body?.message || xhr.statusText);
                    } catch {
                        onError(xhr.statusText);
                    }
                    resolve(null);
                }
            };

            xhr.onerror = () => {
                setUploading(false);
                setProgress(null);
                onError('Network error');
                resolve(null);
            };

            xhr.send(formData);
        });
    }, [onError]);

    return { progress, uploading, upload };
}
