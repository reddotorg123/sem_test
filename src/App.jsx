/**
 * 🚀 MAIN APPLICATION ENTRY POINT
 * 
 * This file orchestrates the entire application:
 * 1. Routing (Pages)
 * 2. Theme Management (Light/Dark)
 * 3. Firebase Initialization & Real-time Sync
 * 4. Background Maintenance (Notifications & Status checks)
 */

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { db, updateAllEventStatuses } from './db';
import { useAppStore } from './store';
import { initNotificationSystem } from './notifications';
import { initFirebase, getUserData } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from './utils';

// --- EAGERLY LOADED COMPONENTS (Essential for fast first paint) ---
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Login from './components/Login';
import SplashScreen from './components/SplashScreen'; // Added Splash Screen

// --- LAZY LOADED COMPONENTS (Loaded only when needed to save bandwidth) ---
const Dashboard = lazy(() => import('./components/Dashboard'));
const EventList = lazy(() => import('./components/EventList'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const Analytics = lazy(() => import('./components/Analytics'));
const Settings = lazy(() => import('./components/Settings'));
const Discovery = lazy(() => import('./components/Discovery'));
const AddEventModal = lazy(() => import('./components/AddEventModal'));
const ImportCSVModal = lazy(() => import('./components/ImportCSVModal'));
const EventDetailsModal = lazy(() => import('./components/EventDetailsModal'));
const EditEventModal = lazy(() => import('./components/EditEventModal'));
const PaymentModal = lazy(() => import('./components/PaymentModal'));
const TeamInviteModal = lazy(() => import('./components/TeamInviteModal'));
const JoinTeam = lazy(() => import('./components/JoinTeam'));
const FeedbackModal = lazy(() => import('./components/FeedbackModal'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const LegalModal = lazy(() => import('./components/LegalModal'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

/**
 * 🔄 Animated Routes Container
 * Handles page transitions with Framer Motion.
 */

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', fontFamily: 'monospace' }}>
                    <h2>Something went wrong.</h2>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

function AnimatedRoutes({ user }) {
    const location = useLocation();

    // If not logged in, only allow the /invite route
    if (!user) {
        return (
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/invite/:teamId" element={<Suspense fallback={null}><JoinTeam /></Suspense>} />
                    <Route path="*" element={null} />
                </Routes>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Suspense fallback={null}><Dashboard /></Suspense>} />
                <Route path="/events" element={<Suspense fallback={null}><EventList /></Suspense>} />
                <Route path="/calendar" element={<Suspense fallback={null}><CalendarView /></Suspense>} />
                <Route path="/analytics" element={<Suspense fallback={null}><Analytics /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={null}><Settings /></Suspense>} />
                <Route path="/discovery" element={<Suspense fallback={null}><Discovery /></Suspense>} />
                <Route path="/admin" element={<Suspense fallback={null}><AdminPanel /></Suspense>} />
                <Route path="/invite/:teamId" element={<Suspense fallback={null}><JoinTeam /></Suspense>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AnimatePresence>
    );
}

function App() {
    // Hooks to access the Store (Global State)
    const theme = useAppStore((state) => state.theme);
    const user = useAppStore((state) => state.user);
    const setUser = useAppStore((state) => state.setUser);
    const firebaseConfig = useAppStore((state) => state.firebaseConfig);
    const cloudProvider = useAppStore((state) => state.cloudProvider);
    const userRole = useAppStore((state) => state.userRole);
    const teamId = useAppStore((state) => state.teamId);

    // Local loading states
    const [isLoading, setIsLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(true);

    /**
     * EFFECT: Safety Timeout
     * Prevents the app from being stuck on a blank screen if Firebase hangs.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) {
                console.warn('[System] Loading took too long. Forcing start...');
                setIsLoading(false);
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    /**
     * EFFECT: Apply Theme
     * Runs whenever the user toggles Light/Dark mode.
     */
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    /**
     * EFFECT: Initialize Firebase & Listen for Auth Changes
     * This is the "Engine Room" of the application connectivity.
     */
    useEffect(() => {
        // Step 1: Initialize Firebase with the saved config
        let unsubscribeAuth = () => { };
        let unsubscribeUserData = () => { };

        try {
            const firebaseData = initFirebase(firebaseConfig);

            // Step 2: Listen for User Login / Logout changes
            if (firebaseData?.auth) {
                unsubscribeAuth = onAuthStateChanged(firebaseData.auth, async (firebaseUser) => {
                    console.log('[Auth] State changed. User:', firebaseUser?.email || 'None');
                    setUser(firebaseUser); // Sync user status to the store
                    unsubscribeUserData(); // clear any previous listener

                    if (firebaseUser) {
                        // Cold Start: Use UID as teamId immediately to avoid global data collision before profile loads
                        const currentTeamId = useAppStore.getState().teamId;
                        if (!currentTeamId) {
                            useAppStore.getState().setTeamId(firebaseUser.uid);
                        }

                        try {
                            const { subscribeToUserData } = await import('./services/firebase');
                            unsubscribeUserData = subscribeToUserData(firebaseUser.uid, (userData) => {
                                useAppStore.getState().setUserRole(userData.role);
                                useAppStore.getState().setTeamId(userData.teamId); // This will return userData.teamId || uid from the firebase service
                                useAppStore.getState().setUserProfile(userData);
                                useAppStore.getState().setIsRoleVerified(true);
                                setIsLoading(false);
                            });
                        } catch (err) {
                            console.error('[Auth] Failed to fetch user data:', err);
                            useAppStore.getState().setIsRoleVerified(false);
                            setIsLoading(false);
                        }
                    } else {
                        useAppStore.getState().setIsRoleVerified(false);
                        setIsLoading(false);
                    }
                });
            } else {
                setIsLoading(false);
            }
        } catch (error) {
            console.error('[Auth] Initialization crash:', error);
            setIsLoading(false);
        }

        return () => {
            unsubscribeAuth();
            unsubscribeUserData();
        };
    }, [firebaseConfig, setUser]);

    /**
     * EFFECT: Real-time Data Sync
     * Only starts AFTER auth is confirmed (isLoading === false) and user is logged in.
     */
    useEffect(() => {
        if (isLoading || !user || cloudProvider !== 'firestore') return;

        let unsubscribeGlobal = () => { };
        let unsubscribeTeamStats = () => { };

        const startSync = async () => {
            try {
                const { 
                    subscribeToGlobalEvents, 
                    subscribeToTeamEventData 
                } = await import('./services/firebase');

                console.log('[Sync] Starting dual-channel real-time sync...');

                // 1. Sync Shared Events Catalog
                unsubscribeGlobal = subscribeToGlobalEvents(
                    async (remoteEvents) => {
                        const { bulkImportEvents } = await import('./db');
                        await bulkImportEvents(remoteEvents, true);
                    },
                    (error) => console.error('[Sync] Global events failed:', error)
                );

                // 2. Sync Private Team Performance Data
                if (teamId) {
                    unsubscribeTeamStats = subscribeToTeamEventData(
                        teamId,
                        async (statsMap) => {
                            const { bulkImportTeamEventData } = await import('./db');
                            await bulkImportTeamEventData(statsMap, teamId);
                        },
                        (error) => console.error('[Sync] Team performance sync failed:', error)
                    );
                }
            } catch (error) {
                console.error('[Sync] Setup crash:', error);
            }
        };

        startSync();

        return () => {
            unsubscribeGlobal();
            unsubscribeTeamStats();
        };
    }, [isLoading, user, cloudProvider, firebaseConfig, teamId, userRole]);

    /**
     * EFFECT: System Maintenance
     * Runs periodic tasks like status updates and notification checks.
     */
    useEffect(() => {
        try {
            updateAllEventStatuses();
            initNotificationSystem();
        } catch (error) {
            console.error('[System] Maintenance crash:', error);
        }

        const interval = setInterval(() => {
            try {
                updateAllEventStatuses();
            } catch (e) {
                console.error('[System] Periodic update failed:', e);
            }
        }, 6 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <ErrorBoundary>
            {/* Splash Screen (High Z-Index) */}
            {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

            {/* Main Application Content */}
            <div className={cn("contents", isLoading && "hidden")}>
                <Router>
                    <RoutesWrapper 
                        user={user} 
                        isLoading={isLoading}
                    />
                </Router>
            </div>
        </ErrorBoundary>
    );
}

/**
 * 🛰️ ROUTES WRAPPER
 * This component is inside the Router and can use useLocation.
 */
function RoutesWrapper({ user, isLoading }) {
    const location = useLocation();
    const isInviteUrl = location.pathname.startsWith('/invite/');

    if (isLoading) return null;

    if (!user) {
        return (
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/invite/:teamId" element={<Suspense fallback={null}><JoinTeam /></Suspense>} />
                    <Route path="*" element={<Login />} />
                </Routes>
            </AnimatePresence>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-500 pb-24 lg:pb-0">
            <div className="sticky top-0 z-[60]">
                <Header />
            </div>

            <BottomNav />

            {/* Shared Modals */}
            <Suspense fallback={null}>
                <AddEventModal />
                <ImportCSVModal />
                <EventDetailsModal />
                <EditEventModal />
                <PaymentModal />
                <TeamInviteModal />
                <ProfileModal />
                <FeedbackModal />
                <LegalModal />
            </Suspense>

            <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
                <AnimatedRoutes user={user} />
            </main>
        </div>
    );
}

export default App;
