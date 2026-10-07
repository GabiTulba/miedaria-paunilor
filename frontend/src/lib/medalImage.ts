/// The longest side, in pixels, a medal picture is sent at: ~850 dpi at the
/// largest medal the label prints (18 mm), and the renderer's own cap.
const MEDAL_SIDE_PX = 600;

/// File types the browser can decode for a medal; vector files are refused,
/// since only their pixels would reach the label anyway.
export const MEDAL_FILE_TYPES = 'image/png,image/jpeg,image/webp';

const blobAsBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',', 2)[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

/// A medal picture chosen on the device, as the label renderer takes it: a
/// base64 PNG at most MEDAL_SIDE_PX on a side (transparency kept). Rejects
/// if the file isn't an image the browser can decode.
export async function medalPng(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, MEDAL_SIDE_PX / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context unavailable');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!png) throw new Error('PNG encoding failed');
        return await blobAsBase64(png);
    } finally {
        bitmap.close();
    }
}
