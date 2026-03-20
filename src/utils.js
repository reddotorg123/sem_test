import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const resolveImageUrl = (url) => {
    if (!url) return null;

    // Handle Google Drive sharing links
    if (url.includes('drive.google.com')) {
        // Broad match for any file ID in a google drive URL
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
    }

    return url;
};
export const getDefaultPoster = (eventName, seed = '') => {
    // Returning null enforces the application to use the safe, abstract gradient "No Poster" fallback
    // Instead of using misleading placeholder images with text.
    return null;
};
