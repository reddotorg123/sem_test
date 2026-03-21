import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const resolveImageUrl = (url) => {
    if (!url) return null;

    // Handle Google Drive sharing links
    if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
        // match various formats: /d/ID, id=ID, file/d/ID/view, etc.
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                      url.match(/id=([a-zA-Z0-9_-]+)/) ||
                      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                      
        if (match && match[1]) {
            // Using lh3.googleusercontent.com/d/ is more reliable for direct images than drive.google.com/thumbnail
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }

    return url;
};
export const getDefaultPoster = (eventName, seed = '') => {
    // Returning null enforces the application to use the safe, abstract gradient "No Poster" fallback
    // Instead of using misleading placeholder images with text.
    return null;
};
