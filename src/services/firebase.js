/**
 * 🔥 FIREBASE SERVICE COLLABORATION MODULE
 * 
 * This module handles all direct interactions with Firebase:
 * 1. App Initialization
 * 2. Authentication (Login/Register/Logout)
 * 3. Firestore Real-time Database Operations
 */

import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    writeBatch,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    getDoc,
    where
} from "firebase/firestore";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut,
    onAuthStateChanged
} from "firebase/auth";

// These variables will hold our active instances once initialized
export let db = null;   // Firestore instance
export let auth = null; // Auth instance
export let app = null;  // Firebase App instance

/**
 * Initializes Firebase with user-provided configuration.
 * @param {Object} config - The JSON config from Firebase Console.
 */
export const initFirebase = (config) => {
    try {
        // Prevent crashes if config is empty
        if (!config || !config.apiKey) return null;

        // Only initialize once to prevent "duplicate app" errors
        if (!app) {
            app = initializeApp(config);
            db = getFirestore(app);
            auth = getAuth(app);
            console.log("✅ Firebase Engine ignited successfully.");
        }
        return { db, auth };
    } catch (error) {
        console.error("❌ Firebase Init Error:", error);
        return null;
    }
};

/**
 * AUTH: Logs in an existing team member.
 */
export const loginUser = async (email, password) => {
    if (!auth) throw new Error("Firebase Auth not initialized. Check your config in Settings.");
    return signInWithEmailAndPassword(auth, email, password);
};

/**
 * AUTH: Creates a new team account and sets their display name.
 */
export const registerUser = async (email, password, displayName, extras = {}) => {
    if (!auth) throw new Error("Firebase Auth not initialized. Check your config in Settings.");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
        await updateProfile(userCredential.user, { displayName, photoURL: extras.photoURL || '' });
    }

    // Create user document with default role "public"
    if (db) {
        await setDoc(doc(db, "users", userCredential.user.uid), {
            email: email,
            displayName: displayName,
            role: "public",
            mobile: extras.mobile || '',
            college: extras.college || '',
            department: extras.department || '',
            year: extras.year || '',
            section: extras.section || '',
            dob: extras.dob || '',
            regNo: extras.regNo || '',
            locality: extras.locality || '',
            professionalDetails: extras.professionalDetails || '',
            photoURL: extras.photoURL || '',
            createdAt: new Date().toISOString()
        });
    }

    return userCredential;
};

/**
 * AUTH: Ends the current session.
 */
export const logoutUser = async () => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    return signOut(auth);
};

/**
 * FIRESTORE: Get user data (role and teamId)
 */
export const getUserData = async (uid) => {
    if (!db) return { role: 'public', teamId: null, hasSubscription: false, position: 'Explorer' };
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return {
                ...data,
                role: data.role || "public",
                teamId: data.teamId || null,
                hasSubscription: !!data.hasSubscription,
                position: data.position || 'Explorer'
            };
        }
        return { role: "public", teamId: null, hasSubscription: false, position: 'Explorer' };
    } catch (error) {
        console.error("Error fetching user data:", error);
        return { role: "public", teamId: null, hasSubscription: false, position: 'Explorer' };
    }
};

/**
 * FIRESTORE: Get all members of a team
 */
export const getTeamMembers = async (teamId) => {
    if (!db || !teamId) return [];
    try {
        const q = query(collection(db, "users"), where("teamId", "==", teamId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching team members:", error);
        return [];
    }
};

/**
 * FIRESTORE: Update profile data
 */
export const updateUserProfile = async (uid, data) => {
    if (!db) throw new Error("Firestore not initialized");
    await setDoc(doc(db, "users", uid), data, { merge: true });
};

/**
 * FIRESTORE: Set user role (Admin only)
 */
export const getAllUsers = async () => {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
};

export const updateUserRole = async (uid, role) => {
    if (!db) throw new Error("Firestore not initialized");
    await setDoc(doc(db, "users", uid), { role }, { merge: true });
};

/**
 * FIRESTORE: Create a manual payment request for admin verification.
 */
export const createPaymentRequest = async (requestData) => {
    if (!db) {
        console.error("Firestore not initialized when calling createPaymentRequest");
        throw new Error("Firestore is not initialized. Please check your Firebase configuration in Settings.");
    }

    // Fallback for environment where crypto.randomUUID might not be available
    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const requestRef = doc(db, "payment_requests", requestId);

    try {
        await setDoc(requestRef, {
            ...requestData,
            requestId,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        return requestId;
    } catch (error) {
        console.error("Firestore Error in createPaymentRequest:", error);
        throw error; // Re-throw to be caught by the UI
    }
};

/**
 * FIRESTORE: Sets up a real-time listener for event changes.
 * Whenever anyone updates an event, this function calls the callback with the new data.
 * @param {string} teamId - Filter events by teamId for multi-user isolation.
 * @param {string} userRole - If admin, can see all events.
 */
export const subscribeToEvents = (callback, onError, teamId = null, userRole = null) => {
    if (!db) return null;
    const eventsRef = collection(db, "events");

    // We fetch ALL events ordered by creation date. 
    // This ensures compatibility with legacy data and simplified "Public Edition" access.
    const q = query(eventsRef, orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                serverId: doc.id,
                id: undefined // Let local DB handle local ID
            };
        }).filter(event => {
            // PUBLIC EDITION LOGIC:
            // 1. If it's a public/legacy event (no teamId), everyone can see it.
            // 2. If it has a teamId, only members of THAT team or admins can see it.
            if (userRole === 'admin') return true;
            if (!event.teamId) return true; // Legacy/Public events are visible to all
            if (teamId && event.teamId === teamId) return true; // Team events visible to team members
            return false; // Otherwise, it's a private team event
        });
        console.log(`[Firebase] Real-time snapshot: ${events.length} events processed (including legacy/public).`);
        callback(events);
    }, (error) => {
        console.error('[Firebase] Real-time listener error:', error.code, error.message);
        if (onError) onError(error);
    });
};

/**
 * FIRESTORE: Saves a single event to the cloud.
 */
export const saveEventToFirestore = async (event) => {
    if (!db) throw new Error("Firestore not initialized");

    // We use serverId as the document ID for global uniqueness
    if (!event.serverId) {
        // Fallback if missing (should be set by createEvent)
        event.serverId = crypto.randomUUID();
    }
    const eventRef = doc(db, "events", event.serverId);

    // Prepare data for cloud storage
    const cleanEvent = {
        ...event,
        teamId: event.teamId || null,
        createdBy: event.createdBy || auth?.currentUser?.uid || 'unknown'
    };
    delete cleanEvent.posterBlob;
    delete cleanEvent.id; // NEVER save the local ID to the cloud

    // Firestore works best with ISO strings for dates
    ['registrationDeadline', 'startDate', 'endDate', 'createdAt', 'updatedAt'].forEach(key => {
        if (cleanEvent[key] instanceof Date) {
            cleanEvent[key] = cleanEvent[key].toISOString();
        }
    });

    await setDoc(eventRef, cleanEvent);
};

/**
 * FIRESTORE: Deletes an event from the cloud.
 */
export const deleteEventFromFirestore = async (id) => {
    if (!db) throw new Error("Firestore not initialized");
    await deleteDoc(doc(db, "events", id.toString()));
};

/**
 * FIRESTORE: Uploads multiple events at once (used for initial sync).
 */
export const bulkSyncToFirestore = async (events) => {
    if (!db) throw new Error("Firestore not initialized");
    const batch = writeBatch(db); // use a Batch to make it atomic (all or nothing)
    const eventsRef = collection(db, "events");

    events.forEach((event) => {
        const sid = event.serverId || crypto.randomUUID();
        const eventDoc = doc(eventsRef, sid);
        const cleanEvent = { ...event, serverId: sid };
        delete cleanEvent.posterBlob;
        delete cleanEvent.id;

        ['registrationDeadline', 'startDate', 'endDate', 'createdAt', 'updatedAt'].forEach(key => {
            if (cleanEvent[key] instanceof Date) {
                cleanEvent[key] = cleanEvent[key].toISOString();
            }
        });

        batch.set(eventDoc, cleanEvent);
    });

    await batch.commit(); // Execute all operations at once
};
/**
 * FIRESTORE: Fetches all payment requests (Admin only)
 */
export const getPaymentRequests = async () => {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(
            query(collection(db, "payment_requests"), orderBy("createdAt", "desc"))
        );
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching payment requests:", error);
        return [];
    }
};

/**
 * FIRESTORE: Approves a payment request and upgrades user role.
 */
export const approvePaymentRequest = async (requestId, userId, planRole) => {
    if (!db) throw new Error("Firestore not initialized");

    const batch = writeBatch(db);

    // 1. Update request status
    const requestRef = doc(db, "payment_requests", requestId);
    batch.update(requestRef, {
        status: 'approved',
        approvedAt: new Date().toISOString()
    });

    // 2. Update user role
    const userRef = doc(db, "users", userId);
    batch.update(userRef, { role: planRole });

    await batch.commit();
};

/**
 * FIRESTORE: Rejects a payment request.
 */
export const rejectPaymentRequest = async (requestId, reason = '') => {
    if (!db) throw new Error("Firestore not initialized");

    const requestRef = doc(db, "payment_requests", requestId);
    await setDoc(requestRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString()
    }, { merge: true });
};
