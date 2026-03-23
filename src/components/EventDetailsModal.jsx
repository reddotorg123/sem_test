import React, { useRef, useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateEvent, deleteEvent, EventStatus } from '../db';
import { useAppStore } from '../store';
import { X, Calendar, MapPin, Trophy, Users, ExternalLink, Trash2, Edit, Clock, Sparkles, Heart, Phone, Info, Globe, Shield, ShieldCheck, Zap, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn, resolveImageUrl, getDefaultPoster } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

// Safe Formatter
const safeFormat = (date, formatStr) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        return format(d, formatStr);
    } catch (e) {
        return 'TBD';
    }
};

const DetailPosterImage = ({ event }) => {
    const [imgSrc, setImgSrc] = useState(null);

    useEffect(() => {
        let objectUrl = null;

        if (event.posterBlob instanceof Blob) {
            objectUrl = URL.createObjectURL(event.posterBlob);
            setImgSrc(objectUrl);
        } else if (typeof event.posterBlob === 'string' && event.posterBlob) {
            setImgSrc(resolveImageUrl(event.posterBlob));
        } else if (event.posterUrl) {
            setImgSrc(resolveImageUrl(event.posterUrl));
        } else {
            setImgSrc(null);
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [event.posterBlob, event.posterUrl]);

    if (!imgSrc) return (
        <div className="w-full h-32 sm:h-40 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-transparent rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 mb-3">
            <Zap size={24} className="text-indigo-400 mb-2 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">No Information Poster</span>
        </div>
    );

    return (
        <div className="mb-3 group relative rounded-xl overflow-hidden shadow-lg border border-white/20">
            <img
                src={imgSrc}
                alt={event.eventName}
                className="w-full max-h-[220px] sm:max-h-[300px] object-cover bg-slate-900 group-hover:scale-105 transition-transform duration-700"
                onError={() => setImgSrc(null)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                <p className="text-white text-[8px] font-black uppercase tracking-widest">Image Source Locked</p>
            </div>
        </div>
    );
};

const ZoomImage = ({ event }) => {
    const [zoomSrc, setZoomSrc] = useState(null);

    useEffect(() => {
        let objectUrl = null;
        if (event.posterBlob instanceof Blob) {
            objectUrl = URL.createObjectURL(event.posterBlob);
            setZoomSrc(objectUrl);
        } else if (typeof event.posterBlob === 'string' && event.posterBlob) {
            setZoomSrc(resolveImageUrl(event.posterBlob));
        } else if (event.posterUrl) {
            setZoomSrc(resolveImageUrl(event.posterUrl));
        } else {
            setZoomSrc(null);
        }
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [event.posterBlob, event.posterUrl]);

    if (!zoomSrc) return null;
    return (
        <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            src={zoomSrc}
            className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
        />
    );
};

const EventDetailsModal = () => {
    const modals = useAppStore((state) => state.modals);
    const closeModal = useAppStore((state) => state.closeModal);
    const selectedEvent = useAppStore((state) => state.selectedEvent);
    const isOpen = modals.eventDetails;
    const userRole = useAppStore((state) => state.userRole);
    const isRoleVerified = useAppStore((state) => state.isRoleVerified);
    const canManage = (userRole === 'admin' || userRole === 'event_manager') && isRoleVerified;

    const eventRaw = useLiveQuery(
        () => selectedEvent ? db.events.get(selectedEvent) : null,
        [selectedEvent]
    );

    const teamData = useLiveQuery(
        () => {
            const teamId = useAppStore.getState().teamId;
            return (selectedEvent && teamId) ? db.teamEventData.where({ teamId, eventId: eventRaw?.serverId }).first() : null;
        },
        [selectedEvent, eventRaw?.serverId]
    );

    const event = useMemo(() => {
        if (!eventRaw) return null;
        
        const now = new Date();
        const endDate = new Date(eventRaw.endDate);
        const deadline = new Date(eventRaw.registrationDeadline);
        
        let status = teamData?.status || eventRaw.status;
        const manualStatuses = [EventStatus.WON, EventStatus.ATTENDED, EventStatus.REGISTERED, EventStatus.SHORTLISTED, EventStatus.BLOCKED];
        
        if (!manualStatuses.includes(status)) {
            if (!isNaN(endDate.getTime()) && now > endDate) status = EventStatus.COMPLETED;
            else if (!isNaN(deadline.getTime()) && now > deadline) status = EventStatus.CLOSED;
        }

        return {
            ...eventRaw,
            status,
            prizeWon: teamData?.prizeWon || 0,
            isShortlisted: !!teamData?.isShortlisted
        };
    }, [eventRaw, teamData]);

    const openModal = useAppStore((state) => state.openModal);
    const preferences = useAppStore((state) => state.preferences);
    const modalContentRef = useRef(null);
    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        // Only lock scroll if the modal is open AND we have event data to show
        // This prevents the "freeze" where the scroll is locked but no modal is visible yet
        if (isOpen && event) {
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';

            requestAnimationFrame(() => {
                if (modalContentRef.current) {
                    modalContentRef.current.scrollTo(0, 0);
                }
            });
        }
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
        };
    }, [isOpen, event]);

    const handleDelete = async () => {
        if (preferences.isDeleteLocked) {
            const pin = prompt('Safe mode is active. Enter PIN:');
            if (pin !== '2026') {
                alert('Access Denied.');
                return;
            }
        }
        if (window.confirm('Erase this event from the grid?')) {
            await deleteEvent(event.id);
            closeModal('eventDetails');
        }
    };

    const handleEdit = () => {
        closeModal('eventDetails');
        openModal('editEvent');
    };

    const handleStatusChange = async (newStatus) => {
        const { updateTeamEventStatus } = await import('../db');
        await updateTeamEventStatus(event.serverId, { status: newStatus });
    };

    const handlePrizeWonChange = async () => {
        const amount = prompt("Enter prize amount won by your team:", event.prizeWon || 0);
        if (amount === null) return;
        const { updateTeamEventStatus } = await import('../db');
        await updateTeamEventStatus(event.serverId, { prizeWon: amount });
    };

    return ReactDOM.createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Persistent Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => closeModal('eventDetails')}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    {/* Content Switcher */}
                    <AnimatePresence mode="wait">
                        {!event ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative z-10 bg-white dark:bg-slate-900 p-8 rounded-[2rem] flex flex-col items-center gap-4 shadow-2xl"
                            >
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Signal...</p>
                            </motion.div>
                        ) : (
                            <React.Fragment key="modal-wrapper">
                                <motion.div
                                    key="modal-content"
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative w-full max-w-[92%] sm:max-w-md md:max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[1.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden flex flex-col max-h-[88vh]"
                            >
                {/* Header Section */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 px-4 py-3 sm:px-5 sm:py-4 text-white relative shrink-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-[6px] sm:text-[7px] font-black uppercase tracking-widest border border-white/20">
                            {event.eventType}
                        </div>
                        <div className={cn(
                            "px-1.5 py-0.5 backdrop-blur-md rounded text-[6px] sm:text-[7px] font-black uppercase tracking-widest border",
                            event.status === 'Registered' ? "bg-emerald-500/20 border-emerald-500/20 text-emerald-100" :
                                event.status === 'Deadline Today' ? "bg-amber-500/20 border-amber-500/20 text-amber-100 animate-pulse" :
                                    "bg-white/10 border-white/10"
                        )}>
                            {event.status}
                        </div>
                    </div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight pr-16">{event.eventName}</h2>
                    <p className="text-[9px] sm:text-[10px] text-white/70 font-bold mt-0.5 flex items-center gap-1.5">
                        <Globe size={9} />
                        {event.collegeName}
                    </p>

                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        <button
                            onClick={async () => {
                                if (userRole === 'public') {
                                    openModal('payment');
                                } else {
                                    const { updateTeamEventStatus } = await import('../db');
                                    await updateTeamEventStatus(event.serverId, { isShortlisted: !event.isShortlisted });
                                }
                            }}
                            className={cn(
                                "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all border",
                                event.isShortlisted ? "bg-rose-500 border-rose-400 text-white" : "bg-white/10 border-white/10 text-white/60 hover:bg-white/20"
                            )}
                        >
                            <Heart size={12} className="sm:size-[14px]" fill={event.isShortlisted ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={() => closeModal('eventDetails')}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all border border-white/20"
                        >
                            <X size={14} className="sm:size-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-950/20" ref={modalContentRef}>
                    <div className="p-3 sm:p-4">
                        {/* Poster Image (Zoomable) */}
                        <div onClick={() => setIsZoomed(true)} className="cursor-zoom-in relative group rounded-xl overflow-hidden shadow-lg border border-white/20 mb-3">
                            <DetailPosterImage event={event} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] border border-white/30 px-3 py-1 rounded-full backdrop-blur-sm">Click to Expand</span>
                            </div>
                        </div>

                        {/* Prize Pool Bar */}
                        <div 
                            onClick={userRole !== 'public' ? handlePrizeWonChange : undefined}
                            className={cn(
                                "p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl text-white shadow-lg shadow-amber-500/10 flex justify-between items-center overflow-hidden relative mb-3 cursor-pointer group",
                                userRole === 'public' && "cursor-default brightness-90"
                            )
                        }>
                            <Trophy size={44} className="absolute -right-1 -bottom-1 opacity-20 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-80 block">Prize Pool / Earnings</span>
                                <h3 className="text-xl sm:text-2xl font-black">₹{(event.prizeAmount || 0).toLocaleString()}</h3>
                            </div>
                            <div className="relative z-10 px-2 py-1 bg-white/20 rounded-lg flex flex-col items-end">
                                <span className="text-[6px] font-black uppercase opacity-70">Team Winnings</span>
                                <span className="text-[10px] font-black">{event.prizeWon ? `₹${event.prizeWon}` : '₹0'}</span>
                            </div>
                        </div>

                        {/* Info Grid - 2x2 compact */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {/* Deadline Card - Interactive */}
                            <div
                                onClick={async () => {
                                    if (event.status !== 'Registered') {
                                        if (confirm("Mark this event as registered? This will track it as 'Participating'.")) {
                                            const { updateTeamEventStatus } = await import('../db');
                                            await updateTeamEventStatus(event.serverId || event.id, { status: 'Registered' });
                                        }
                                    }
                                }}
                                className={cn(
                                    "p-2.5 sm:p-3 rounded-lg border shadow-sm transition-all cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800",
                                    event.status === 'Registered' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" :
                                        event.status === 'Completed' || event.status === 'Closed' ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60" :
                                            "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                                )}
                            >
                                <div className={cn("flex items-center gap-1.5 mb-0.5",
                                    event.status === 'Registered' ? "text-emerald-600 dark:text-emerald-400" :
                                        (event.status === 'Deadline Today' || event.status === 'Open') ? "text-amber-500" : "text-slate-400"
                                )}>
                                    {event.status === 'Registered' ? <ShieldCheck size={10} /> : <Calendar size={10} />}
                                    <span className={cn("text-[7px] font-black uppercase tracking-wider", event.status === 'Registered' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>
                                        {event.status === 'Registered' ? 'Registered' : 'Deadline'}
                                    </span>
                                </div>
                                <p className={cn("text-[11px] sm:text-xs font-black",
                                    event.status === 'Registered' ? "text-emerald-700 dark:text-emerald-300" :
                                        (event.status === 'Deadline Today' || event.status === 'Open') ? "text-amber-600 dark:text-amber-400" :
                                            "text-slate-500 dark:text-slate-400"
                                )}>
                                    {event.status === 'Registered' ? 'Participation Confirmed' : safeFormat(event.registrationDeadline, 'MMM dd, yyyy')}
                                </p>
                            </div>

                            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center gap-1.5 text-indigo-500 mb-0.5">
                                    <Zap size={10} />
                                    <span className="text-[7px] font-black uppercase tracking-wider text-slate-400">Schedule</span>
                                </div>
                                <p className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white">{safeFormat(event.startDate, 'MMM dd')} - {safeFormat(event.endDate, 'dd')}</p>
                            </div>
                            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0"><MapPin size={11} /></div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-wider text-slate-400 block">Location</span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white leading-none truncate block">{event.location || 'Campus'}</span>
                                </div>
                                {event.isOnline && <div className="text-[6px] font-black uppercase px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 shrink-0">Online</div>}
                            </div>
                            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0"><Users size={11} /></div>
                                <div className="flex-1">
                                    <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-wider text-slate-400 block">Requirement</span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white uppercase leading-none">
                                        {event.teamSize > 1
                                            ? (event.teamName ? <><span className="text-indigo-600">{event.teamName}</span> <span className="text-slate-400">({event.teamSize})</span></> : `Squad of ${event.teamSize}`)
                                            : 'Solo Person'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Contact Bar */}
                        <a 
                            href={userRole === 'public' ? '#' : `tel:${event.contact1}`} 
                            onClick={(e) => userRole === 'public' && (e.preventDefault(), openModal('payment'))}
                            className="p-2.5 sm:p-3 bg-slate-900 text-white rounded-lg shadow-sm flex items-center gap-2.5 hover:scale-[1.01] transition-transform mb-3"
                        >
                            <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-white shrink-0"><Phone size={12} /></div>
                            <div className="flex-1">
                                <span className="text-[7px] font-black uppercase tracking-wider text-white/50 block">Primary Contact</span>
                                <span className="text-[11px] font-mono font-bold leading-none">
                                    {(event.contact1 && userRole !== 'public') 
                                        ? event.contact1 
                                        : (event.contact1 
                                            ? `${event.contact1.substring(0, 3)}****${event.contact1.substring(event.contact1.length - 3)}` 
                                            : '91+ **********')}
                                </span>
                            </div>
                            {userRole === 'public' && <div className="text-[6px] font-black uppercase px-1.5 py-1 bg-indigo-500 rounded text-white tracking-widest">Unlock</div>}
                        </a>

                        {/* About Section */}
                        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm mb-3">
                            <div className="flex items-center gap-1.5 mb-2 text-indigo-500">
                                <Info size={12} />
                                <span className="text-[7px] font-black uppercase tracking-widest">About the Event</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                {event.description || 'No detailed briefing available for this operative.'}
                            </p>
                        </div>

                        {/* More Details (Eligibility, Website button) */}
                        {event.eligibility && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-3">
                                <div className="flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400">
                                    <Shield size={10} />
                                    <span className="text-[7px] font-black uppercase tracking-widest">Eligibility Protocol</span>
                                </div>
                                <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300">{event.eligibility}</p>
                            </div>
                        )}

                        {/* Status Grid - Available to all logged-in users */}
                        {userRole !== 'public' && (
                            <div className="mb-4">
                                <h4 className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1.5"><ShieldCheck size={10}/> Update Your Team Status</h4>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {Object.values(EventStatus || {}).map(status => (
                                        <button
                                            key={status}
                                            onClick={() => handleStatusChange(status)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                                event.status === status
                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-indigo-300"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {event.website && (
                            <a
                                href={event.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 w-full h-10 sm:h-11 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 group hover:brightness-110 transition-all font-black text-[9px] uppercase tracking-widest"
                            >
                                <Globe size={14} />
                                Official Website
                                <ExternalLink size={12} />
                            </a>
                        )}

                        {event.registrationLink && (
                            <a
                                href={event.registrationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 w-full h-10 sm:h-11 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 group hover:brightness-110 transition-all font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                            >
                                <ExternalLink size={14} />
                                Registration Form
                                <ExternalLink size={12} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
                    {canManage && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1.5 px-3 py-2 text-rose-500 font-black text-[8px] uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                        >
                            <Trash2 size={12} />
                            Delete
                        </button>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        {canManage && (
                            <button
                                onClick={handleEdit}
                                className="px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-black text-[8px] uppercase tracking-widest hover:brightness-95 transition-all flex items-center gap-1.5"
                            >
                                <Edit size={12} />
                                Edit Details
                            </button>
                        )}
                        <button
                            onClick={() => closeModal('eventDetails')}
                            className="px-4 sm:px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-black text-[8px] uppercase tracking-widest hover:brightness-110 transition-all"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* FULL SCREEN IMAGE ZOOM MODAL */}
            <AnimatePresence>
                {isZoomed && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsZoomed(false)}
                        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 cursor-zoom-out"
                    >
                        <ZoomImage event={event} />
                        <button className="absolute top-4 right-4 text-white/50 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md">
                            <X size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            </React.Fragment>
        )}
        </AnimatePresence>
        </div>
        )}
        </AnimatePresence>,
        document.body
    );
};

export default EventDetailsModal;
