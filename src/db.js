/**
 * 💾 INDEXED-DB CORE DATABASE LAYER
 * 
 * This file powers the "Offline-First" capability of the app.
 * It uses Dexie.js to manage a local database in the user's browser.
 * 
 * CRITICAL FLOW:
 * Local Action -> Update IndexedDB -> Sync to Firebase
 */

import Dexie from 'dexie';
import { useAppStore } from './store';
import { saveEventToFirestore, deleteEventFromFirestore } from './services/firebase';

/**
 * Define the Database Schema
 */
export class EventDatabase extends Dexie {
    constructor() {
        super('CollegeEventManager');

        // ++id means auto-incrementing primary key
        this.version(1).stores({
            events: '++id, collegeName, eventName, eventType, registrationDeadline, startDate, endDate, status, priorityScore, createdAt, contact1, contact2, leader, prizeWon, isShortlisted, serverId, teamId, createdBy',
            colleges: '++id, name, location, pastEvents',
            notes: '++id, eventId, content, createdAt',
            settings: 'key, value'
        });
    }
}

export const db = new EventDatabase();

/**
 * Event Constants
 */
export const EventType = {
    HACKATHON: 'Hackathon',
    PAPER_PRESENTATION: 'Paper Presentation',
    PROJECT_EXPO: 'Project Expo',
    WORKSHOP: 'Workshop',
    CONTEST: 'Contest',
    SEMINAR: 'Seminar',
    CONFERENCE: 'Conference',
    OTHER: 'Other'
};

export const EventStatus = {
    OPEN: 'Open',
    REGISTERED: 'Registered',
    DEADLINE_TODAY: 'Deadline Today',
    CLOSED: 'Closed',
    COMPLETED: 'Completed',
    ATTENDED: 'Attended',
    WON: 'Won',
    BLOCKED: 'Blocked'
};

/**
 * Creates a standard event object with defaults.
 */
export const createEvent = ({
    collegeName,
    eventName,
    eventType,
    registrationDeadline,
    startDate,
    endDate,
    prizeAmount = 0,
    registrationFee = 0,
    accommodation = false,
    location = '',
    isOnline = false,
    contactNumbers = [],
    contact1 = '',
    contact2 = '',
    posterUrl = '',
    posterBlob = null,
    website = '',
    registrationLink = '',
    description = '',
    teamSize = 1,
    teamName = '',
    leader = '',
    members = '',
    noOfTeams = '',
    prizeWon = '',
    eligibility = '',
    status = null,
    priorityScore = null,
    customReminders = [],
    tags = [],
    isShortlisted = false,
    createdAt = null,
    updatedAt = null,
    serverId = null,
    teamId = null,
    createdBy = null,
    id = null
}) => {
    const now = new Date();

    const event = {
        id,
        serverId: serverId || crypto.randomUUID(), // Guarantee a unique Server ID
        collegeName,
        eventName,
        eventType,
        registrationDeadline: new Date(registrationDeadline),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        prizeAmount,
        registrationFee,
        accommodation,
        location,
        isOnline,
        contactNumbers,
        contact1,
        contact2,
        posterUrl,
        posterBlob,
        website,
        registrationLink,
        description,
        teamSize,
        teamName,
        leader,
        members,
        noOfTeams,
        prizeWon,
        eligibility,
        status: status || calculateStatus(registrationDeadline, startDate, endDate),
        priorityScore: priorityScore || 0,
        customReminders,
        tags,
        isShortlisted: !!isShortlisted,
        teamId: teamId || null,
        createdBy: createdBy || null,
        createdAt: createdAt ? new Date(createdAt) : now,
        updatedAt: updatedAt ? new Date(updatedAt) : now
    };

    // Remove id if it's null so Dexie can auto-increment if needed
    if (event.id === null) delete event.id;

    return event;
};

/**
 * ENGINE: Automatically decides the status based on current date.
 */
export const calculateStatus = (registrationDeadline, startDate, endDate) => {
    const now = new Date();
    const deadline = new Date(registrationDeadline);
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(deadline.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return EventStatus.OPEN;
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (today > endDateOnly) return EventStatus.COMPLETED;
    if (today >= startDateOnly && today <= endDateOnly) return EventStatus.ATTENDED;
    if (today > deadlineDate) return EventStatus.CLOSED;
    if (today.getTime() === deadlineDate.getTime()) return EventStatus.DEADLINE_TODAY;

    return EventStatus.OPEN;
};

/**
 * ENGINE: Assigns a score (0-100) based on how "lucrative" the event is.
 */
export const calculatePriorityScore = (event) => {
    let score = 0;
    const now = new Date();
    const deadline = new Date(event.registrationDeadline);

    if (isNaN(deadline.getTime())) return 0;

    // 1. Prize to Fee Ratio (Valuable events score higher)
    const prize = parseFloat(event.prizeAmount) || 0;
    const fee = parseFloat(event.registrationFee) || 0;
    if (fee === 0 && prize > 0) score += 40; // Free events with prizes are highly valuable
    else if (fee > 0) {
        const ratio = prize / fee;
        if (ratio >= 20) score += 40;
        else if (ratio >= 10) score += 30;
        else if (ratio >= 5) score += 20;
        else if (ratio >= 2) score += 10;
        else if (ratio >= 1) score += 5;
    }

    // 2. Event Type Weights
    const typeScores = {
        [EventType.HACKATHON]: 25,
        [EventType.PROJECT_EXPO]: 20,
        [EventType.CONTEST]: 20,
        [EventType.PAPER_PRESENTATION]: 15,
        [EventType.WORKSHOP]: 10,
        [EventType.CONFERENCE]: 10,
        [EventType.SEMINAR]: 5,
        [EventType.OTHER]: 5
    };
    score += typeScores[event.eventType] || 5;

    // 3. Urgency (closer deadlines get higher priority naturally)
    const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) score = 0; // Expired
    else if (daysRemaining <= 1) score += 30;
    else if (daysRemaining <= 3) score += 20;
    else if (daysRemaining <= 7) score += 10;

    // 4. Team Bonus (Individual or small team events often easier to enter)
    const tSize = parseInt(event.teamSize) || 1;
    if (tSize === 1) score += 5;

    return Math.min(100, Math.max(0, score));
};

/**
 * DATA OP: Create a new event.
 * Saves locally first, then attempts to sync with Firebase.
 */
export const addEvent = async (eventData) => {
    const event = createEvent(eventData);
    event.priorityScore = calculatePriorityScore(event);

    // Save to Local DB
    const id = await db.events.add(event);
    const result = { ...event, id };

    // Sync to Cloud
    const state = useAppStore.getState();
    if (state.cloudProvider === 'firestore') {
        try {
            await saveEventToFirestore(result);
        } catch (e) {
            console.error('[Sync Fail] Local saved but cloud sync failed:', e);
        }
    }

    return result;
};

/**
 * DATA OP: Update an existing event.
 */
const MANUAL_STATUSES = [EventStatus.WON, EventStatus.ATTENDED, EventStatus.BLOCKED, EventStatus.REGISTERED];

export const updateEvent = async (id, updates) => {
    const updated = { ...updates, updatedAt: new Date() };

    // If dates or financial info changed, recalculate status and score
    if (updates.registrationDeadline || updates.startDate || updates.endDate ||
        updates.prizeAmount || updates.registrationFee) {
        const event = await db.events.get(id);
        const merged = { ...event, ...updates };

        // Only auto-update status if it's NOT a manual status (Won, Attended, Blocked)
        // OR if the user is explicitly updating the status in this very call (updates.status would be present)
        if (!updates.status && !MANUAL_STATUSES.includes(event.status)) {
            updated.status = calculateStatus(merged.registrationDeadline, merged.startDate, merged.endDate);
        }

        updated.priorityScore = calculatePriorityScore(merged);
    }

    await db.events.update(id, updated);
    const finalEvent = await db.events.get(id);

    // Sync to Cloud
    const state = useAppStore.getState();
    if (state.cloudProvider === 'firestore') {
        try {
            await saveEventToFirestore(finalEvent);
        } catch (e) {
            console.error('[Sync Fail] Update failed to sync:', e);
        }
    }

    return finalEvent;
};

/**
 * DATA OP: Remove an event.
 */
export const deleteEvent = async (id) => {
    // Get the event first so we have the serverId for cloud deletion
    const event = await db.events.get(id);
    if (!event) return; // Already deleted?

    await db.events.delete(id);

    // Sync to Cloud
    const state = useAppStore.getState();
    if (state.cloudProvider === 'firestore' && event.serverId) {
        try {
            await deleteEventFromFirestore(event.serverId);
        } catch (e) {
            console.error('[Sync Fail] Delete failed on cloud:', e);
        }
    }
};

/**
 * BULK OP: Used for initial sync from Firebase to Local DB.
 * SET overwrite to true if you want local to EXACTLY match cloud (Deletes local items not in cloud)
 */
export const bulkImportEvents = async (eventsArray, overwrite = false) => {
    if (!eventsArray) return { added: 0, updated: 0 };

    return await db.transaction('rw', db.events, async () => {
        let added = 0;
        let updated = 0;
        const existingEvents = await db.events.toArray();

        // Map existing events by Server ID for precise matching
        const serverIdMap = new Map();
        existingEvents.forEach(e => {
            if (e.serverId) serverIdMap.set(e.serverId, e.id);
        });

        // Also define legacy map (Name + College) for backward compatibility
        const nameMap = new Map(existingEvents.map(e => [`${e.eventName}__${e.collegeName}`.toLowerCase(), e.id]));
        const currentServerIds = new Set(); // Track IDs in this update batch

        for (const data of eventsArray) {
            // Validate data integrity
            if (!data.eventName || data.eventName.length < 2) continue;

            const processed = createEvent(data);
            // If incoming data has a serverId (which it should from Firestore), use it.
            // If createEvent generated a NEW one, we might risk duplication if we don't match correctly.
            // However, subscribeToEvents sets serverId = doc.id, so data.serverId IS set.

            const remoteSid = processed.serverId;
            currentServerIds.add(remoteSid);

            let localIdToUpdate = serverIdMap.get(remoteSid);

            // Fallback: If no ServerID match, try Name Match (Legacy)
            if (!localIdToUpdate) {
                const legacyKey = `${processed.eventName}__${processed.collegeName}`.toLowerCase();
                if (nameMap.has(legacyKey)) {
                    localIdToUpdate = nameMap.get(legacyKey);
                }
            }

            if (localIdToUpdate) {
                // UPDATE existing local event
                const localEvent = existingEvents.find(e => e.id === localIdToUpdate);

                // Preserve local data that isn't in cloud
                if (localEvent?.posterBlob && !processed.posterBlob) {
                    processed.posterBlob = localEvent.posterBlob;
                }

                // IMPORTANT: Keep the Local ID intact!
                // Also ensure we attach the ServerID if the local copy didn't have one
                await db.events.update(localIdToUpdate, { ...processed, id: localIdToUpdate, serverId: remoteSid });
                updated++;
            } else {
                // ADD new event locally
                // Ensure 'id' is undefined so Dexie auto-increments
                delete processed.id;
                await db.events.add(processed);
                added++;
            }
        }

        // Handle deletions if overwrite is enabled
        if (overwrite) {
            // Delete any local event that has a ServerID BUT is not in the remote batch
            for (const e of existingEvents) {
                if (e.serverId && !currentServerIds.has(e.serverId)) {
                    await db.events.delete(e.id);
                }
            }
        }

        return { added, updated };
    });
};

/**
 * UTILITY: Run maintenance (update statuses of all events based on current time)
 */
export const updateAllEventStatuses = async () => {
    const events = await db.events.toArray();
    const state = useAppStore.getState();
    const isCloud = state.cloudProvider === 'firestore';

    for (const event of events) {
        // Skip manual statuses
        if (MANUAL_STATUSES.includes(event.status)) continue;

        const newStatus = calculateStatus(event.registrationDeadline, event.startDate, event.endDate);
        const newScore = calculatePriorityScore(event);

        if (newStatus !== event.status || newScore !== event.priorityScore) {
            const updates = { 
                status: newStatus, 
                priorityScore: newScore,
                updatedAt: new Date() 
            };
            
            await db.events.update(event.id, updates);
            
            // Sync to Cloud if applicable
            if (isCloud) {
                try {
                    const updatedEvent = { ...event, ...updates };
                    await saveEventToFirestore(updatedEvent);
                } catch (e) {
                    console.error('[System Sync] Background status update failed to sync:', e);
                }
            }
        }
    }
};

/**
 * UTILITY: Export all events from the local database.
 */
export const getAllEvents = async () => {
    return await db.events.toArray();
};

export const exportEventsToCSV = async () => {
    return await db.events.toArray();
};

/**
 * UTILITY: Clear everything in the local database.
 */
export const purgeDatabase = async () => {
    await db.events.clear();
    await db.colleges.clear();
    await db.notes.clear();
};
