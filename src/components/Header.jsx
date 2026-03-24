import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { logoutUser, subscribeToNotifications, markNotificationRead } from '../services/firebase';
import { showNotification } from '../notifications';
import { Moon, Sun, Plus, Zap, LogOut, Settings as SettingsIcon, User, MessageSquare, Crown, CreditCard, FileText, ChevronDown, Shield, Bell, X, Info, AlertTriangle, Speaker } from 'lucide-react';
import { cn } from '../utils';

const Header = () => {
    const location = useLocation();
    const theme = useAppStore((state) => state.theme);
    const toggleTheme = useAppStore((state) => state.toggleTheme);
    const openModal = useAppStore((state) => state.openModal);
    const user = useAppStore((state) => state.user);
    const cloudProvider = useAppStore((state) => state.cloudProvider);
    const userRole = useAppStore((state) => state.userRole);
    const isRoleVerified = useAppStore((state) => state.isRoleVerified);
    const canAdd = (userRole === 'admin' || userRole === 'event_manager') && isRoleVerified;

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const profileRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (user?.uid) {
            const unsub = subscribeToNotifications(user.uid, (notifs) => {
                // If we have more notifs than before, show a browser notification for the latest one
                const prevCount = notifications.length;
                if (notifs.length > prevCount && prevCount > 0) {
                    const latest = notifs[0]; // because sorted by desc in firebase
                    if (!latest.isRead) {
                        showNotification(latest.title, { body: latest.content });
                    }
                }
                setNotifications(notifs);
            });
            return () => unsub && unsub();
        }
    }, [user?.uid, notifications.length]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const setUser = useAppStore((state) => state.setUser);

    const handleLogout = async () => {
        try {
            if (cloudProvider === 'firestore') {
                await logoutUser();
            }
            setUser(null);
            window.location.reload();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const navItems = [
        { path: '/', label: 'Dashboard' },
        { path: '/events', label: 'Events' },
        { path: '/discovery', label: 'Discovery' },
        { path: '/calendar', label: 'Calendar' },
        { path: '/analytics', label: 'Analytics' }
    ];

    return (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm px-safe">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16 md:h-20">
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center group">
                            <div className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-xs">JD</span>
                            </div>
                            <div className="flex flex-col ml-3">
                                <span className="text-xl font-black text-[#1e1b4b] dark:text-white leading-none flex items-center gap-1">
                                    SEM
                                </span>
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mt-1">
                                    {userRole === 'public' ? 'PUBLIC' : 'TEAM'} <span className="hidden sm:inline">EDITION</span>
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                to={item.path}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${location.pathname === item.path
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center space-x-4">
                        {canAdd && (
                            <button
                                onClick={() => openModal('addEvent')}
                                className="h-10 px-4 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={18} />
                                <span className="hidden sm:inline">Add Event</span>
                            </button>
                        )}

                        <button
                            onClick={toggleTheme}
                            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </button>

                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative",
                                    isNotifOpen ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600" : "text-slate-400 hover:text-indigo-600"
                                )}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-[70] animate-in fade-in slide-in-from-top-2">
                                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Tactical Intel</h3>
                                        {unreadCount > 0 && (
                                            <button 
                                                onClick={() => notifications.forEach(n => !n.isRead && markNotificationRead(n.id))}
                                                className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                                            >
                                                Mute All
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[70vh] overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div 
                                                    key={notif.id}
                                                    onClick={() => markNotificationRead(notif.id)}
                                                    className={cn(
                                                        "px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative",
                                                        !notif.isRead && "bg-indigo-50/30 dark:bg-indigo-900/10"
                                                    )}
                                                >
                                                    {!notif.isRead && (
                                                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-full" />
                                                    )}
                                                    <div className="flex gap-4">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center",
                                                            notif.type === 'warning' ? "bg-amber-100 text-amber-600" : 
                                                            notif.type === 'announcement' ? "bg-indigo-100 text-indigo-600" :
                                                            "bg-slate-100 text-slate-600"
                                                        )}>
                                                            {notif.type === 'warning' ? <AlertTriangle size={18} /> : 
                                                             notif.type === 'announcement' ? <Speaker size={18} /> :
                                                             <Info size={18} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black text-slate-900 dark:text-white mb-0.5 uppercase tracking-tight">{notif.title}</p>
                                                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{notif.content}</p>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                {new Date(notif.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center">
                                                <Bell size={32} className="mx-auto text-slate-200 mb-4" />
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Digital silence on all channels.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative pl-4 border-l border-slate-100 dark:border-slate-800" ref={profileRef}>
                                <button
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 group relative border",
                                        userRole !== 'public' 
                                            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-[0_0_20px_rgba(245,158,11,0.2)]" 
                                            : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800"
                                    )}
                                >
                                    <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center">
                                        {user?.photoURL ? (
                                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={20} />
                                        )}
                                    </div>
                                    {userRole !== 'public' && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 group-hover:rotate-12 transition-transform z-10">
                                            <Crown size={12} className="text-white fill-current" />
                                        </div>
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {isProfileOpen && (
                                    <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-indigo-500/10 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 z-[70]">
                                        <div className="px-4 py-3 mb-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.displayName || 'No Name'}</p>
                                            <p className="text-[10px] text-indigo-500 truncate font-bold">{user.email}</p>
                                        </div>

                                        {(userRole === 'admin' || userRole === 'event_manager') && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 mx-2 mt-1 mb-2 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] transition-all shadow-lg"
                                            >
                                                <Shield size={16} /> Admin Terminal
                                            </Link>
                                        )}

                                        <button
                                             onClick={(e) => { 
                                                 e.stopPropagation();
                                                 e.preventDefault();
                                                 setIsProfileOpen(false); 
                                                 openModal('profile'); 
                                             }}
                                             className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-3"
                                         >
                                             <User size={16} className="text-indigo-500" /> Personalize Profile
                                         </button>

                                        <Link
                                            to="/settings"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-3"
                                        >
                                            <SettingsIcon size={16} className="text-slate-400" /> Account Settings
                                        </Link>

                                        {(userRole === 'public') ? (
                                            <button
                                                onClick={() => { setIsProfileOpen(false); openModal('payment'); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-colors flex items-center gap-3 group"
                                            >
                                                <div className="w-6 h-6 rounded flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 group-hover:bg-indigo-600 transition-colors shrink-0">
                                                    <Crown size={12} className="text-indigo-600 group-hover:text-white transition-colors" />
                                                </div>
                                                <span>Go Premium (₹10)</span>
                                            </button>
                                        ) : (
                                            <div className="px-4 py-2.5 flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-900/10">
                                                <div className="w-6 h-6 rounded flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
                                                    <Crown size={12} className="text-indigo-600" fill="currentColor" />
                                                </div>
                                                <span className="text-[10px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400">TEAM EDITION</span>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => { setIsProfileOpen(false); openModal('legal'); }}
                                            className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-3"
                                        >
                                            <FileText size={16} className="text-slate-400" /> Legal Documents
                                        </button>

                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                        <button
                                            onClick={() => { setIsProfileOpen(false); handleLogout(); }}
                                            className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 transition-colors flex items-center gap-3"
                                        >
                                            <LogOut size={16} /> Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                    </div>
                </div>
            </div>
        </header>
    );
};


export default Header;
