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
export const getDefaultPoster = (eventType, seed = '') => {
    const posters = {
        'Hackathon': 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=2070&auto=format&fit=crop',
        'Workshop': 'https://images.unsplash.com/photo-1540317580384-e5d43867cbc6?q=80&w=1974&auto=format&fit=crop',
        'Contest': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop',
        'Paper Presentation': 'https://images.unsplash.com/photo-1475721027187-dfb367046420?q=80&w=2070&auto=format&fit=crop',
        'Project Expo': 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=2070&auto=format&fit=crop',
        'Seminar': 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop',
        'Conference': 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2069&auto=format&fit=crop',
        'Other': 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=2012&auto=format&fit=crop'
    };

    // Use specific poster or fallback based on array/string input
    const type = Array.isArray(eventType) ? eventType[0] : eventType;
    return posters[type] || posters['Other'];
};

