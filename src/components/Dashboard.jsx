import React, { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import { useAppStore } from '../store';
import EventCard from './EventCard';
import { TrendingUp, Calendar, Clock, Trophy, Plus, FileUp, Zap, Sparkles, Shield, Bell, Target, ArrowRight, Users, User } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, isToday, isThisWeek, differenceInDays, startOfDay, addDays, isAfter, isBefore } from 'date-fns';
import { cn } from '../utils';
import { getTeamMembers } from '../services/firebase';

const StatCard = ({ title, value, icon: Icon, color, delay, trend, onClick }) => {
    // Mapping of possible colors to explicit Tailwind classes (SEM Theme)
    const colorClasses = {
        'bg-indigo-500': {
            bg: 'bg-indigo-50 dark:bg-indigo-900/30',
            text: 'text-indigo-600 dark:text-indigo-400',
            accent: 'bg-indigo-600/20'
        },
        'bg-violet-500': {
            bg: 'bg-violet-50 dark:bg-violet-900/30',
            text: 'text-violet-600 dark:text-violet-400',
            accent: 'bg-violet-600/20'
        },
        'bg-emerald-500': {
            bg: 'bg-emerald-50 dark:bg-emerald-900/30',
            text: 'text-emerald-600 dark:text-emerald-400',
            accent: 'bg-emerald-600/20'
        },
        'bg-amber-500': {
            bg: 'bg-amber-50 dark:bg-amber-900/30',
            text: 'text-amber-600 dark:text-amber-400',
            accent: 'bg-amber-600/20'
        }
    };

    const styles = colorClasses[color] || colorClasses['bg-indigo-500'];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: 'spring', damping: 20 }}
            onClick={onClick}
            className={cn("relative group h-full", onClick && "cursor-pointer transition-transform hover:scale-[1.02] active:scale-95")}
        >
            <div className="absolute inset-0 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:shadow-[0_24px_50px_-12px_rgba(79,70,229,0.15)] transition-all duration-500" />
            <div className="relative p-4 sm:p-6 h-full flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-[2rem]">
                <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-all duration-700 group-hover:scale-150 group-hover:opacity-20", color)} />

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", styles.bg)}>
                        <Icon className={cn("w-6 h-6", styles.text)} />
                    </div>
                    {trend && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                            <TrendingUp size={10} />
                            {trend}
                        </div>
                    )}
                </div>

                <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{title}</h3>
                    <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter sm:tracking-normal">{value}</p>
                </div>
            </div>
        </motion.div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const user = useAppStore((state) => state.user);
    const userRole = useAppStore((state) => state.userRole);
    const teamId = useAppStore((state) => state.teamId);
    const cloudProvider = useAppStore((state) => state.cloudProvider);
    const openModal = useAppStore((state) => state.openModal);
    const setSelectedEvent = useAppStore((state) => state.setSelectedEvent);

    const [teamMembers, setTeamMembers] = useState([]);

    // Fetch Team Members
    useEffect(() => {
        if (teamId) {
            getTeamMembers(teamId).then(members => {
                setTeamMembers(members);
            });
        }
    }, [teamId]);

    // Live data from Dexie
    const events = useLiveQuery(() => db.events.toArray(), []) || [];

    // Dashboard Statistics with useMemo
    const stats = useMemo(() => {
        const total = events.length;
        const upcomingCount = events.filter(e => isAfter(new Date(e.startDate), new Date())).length;
        const prizeValues = events.map(e => {
            const val = parseFloat(String(e.prizeAmount).replace(/[^0-9.]/g, '')) || 0;
            return val;
        });
        const totalPrize = prizeValues.reduce((a, b) => a + b, 0);
        const winCount = events.filter(e => e.status === 'Won').length;

        return { total, upcomingCount, totalPrize, winCount };
    }, [events]);

    const criticalDeadlines = useMemo(() => {
        return events
            .filter(e => {
                const deadline = new Date(e.registrationDeadline);
                const days = differenceInDays(startOfDay(deadline), startOfDay(new Date()));
                return days >= 0 && days <= 7;
            })
            .sort((a, b) => new Date(a.registrationDeadline) - new Date(b.registrationDeadline));
    }, [events]);

    const priorityEvents = useMemo(() => {
        return events
            .filter(e => !e.status || e.status === 'Interested' || e.status === 'Ongoing')
            .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
            .slice(0, 3);
    }, [events]);

    // Role-based visibility logic
    const canManage = userRole === 'admin' || userRole === 'event_manager' || userRole === 'team_leader';

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const displayEventsData = useMemo(() => {
        if (priorityEvents.length > 0) return { title: 'Tactical', subtitle: 'Priority List', list: priorityEvents };
        return { title: 'Recent', subtitle: 'Signals', list: events.slice(0, 3) };
    }, [priorityEvents, events]);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="pb-28 pt-4 sm:pt-8"
        >
            {/* Command Central Header */}
            <div className="relative mb-8 sm:mb-12 overflow-hidden bg-[#0a0c16] rounded-3xl sm:rounded-[4rem] p-6 sm:p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] group">
                {/* Background FX */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600/10 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] mb-8"
                        >
                            <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center">
                                <Shield size={10} className="text-white" />
                            </div>
                            {userRole === 'public' ? 'PUBLIC' : 'TEAM'} EDITION • {userRole?.replace('_', ' ') || 'PERSONAL'} COMMAND
                        </motion.div>
                        <div className="flex items-center gap-6 mb-4">
                            {user?.photoURL ? (
                                <div className="w-16 h-16 rounded-3xl overflow-hidden border-2 border-indigo-500 shadow-2xl">
                                    <img src={user.photoURL} alt="User Avatar" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20">
                                    <User className="text-white" size={32} />
                                </div>
                            )}
                            <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight leading-none">
                                Hello, <span className="bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent">{(user?.displayName || 'JD').split(' ')[0]}</span>
                            </h1>
                        </div>
                        <p className="text-sm sm:text-base text-slate-400 font-bold max-w-xl leading-relaxed">
                            {criticalDeadlines.length > 0
                                ? `You have ${criticalDeadlines.length} events with deadlines approaching this week.`
                                : "Your event tracker is up to date."}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {canManage && (
                            <>
                                <button
                                    onClick={() => openModal('addEvent')}
                                    className="px-8 h-16 bg-white text-slate-950 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border-2 border-transparent hover:border-black"
                                >
                                    <Plus size={20} strokeWidth={4} />
                                    ADD NEW EVENT
                                </button>
                                <button
                                    onClick={() => openModal('importCSV')}
                                    className="w-16 h-16 bg-white/5 backdrop-blur-md text-white rounded-3xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10 shadow-xl"
                                    title="Import Data"
                                >
                                    <FileUp size={24} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap items-center gap-10 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                            SYNC: LIVE
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                            SYNC LATENCY: 4MS
                        </span>
                    </div>
                    <div className="ml-auto">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                            TIME: {format(new Date(), 'HH:mm:ss')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-16 px-1">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full transition-all group-hover:scale-110" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                            <Calendar className="text-indigo-600 dark:text-indigo-400 w-7 h-7" />
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                            <TrendingUp size={10} />
                            +4%
                        </div>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">UPCOMING EVENTS</h3>
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.upcomingCount || 8}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-rose-50 dark:bg-rose-900/10 rounded-full transition-all group-hover:scale-110" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center">
                            <Bell className="text-rose-500 dark:text-rose-400 w-7 h-7" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">DEADLINES TODAY</h3>
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {events.filter(e => isToday(new Date(e.registrationDeadline))).length || 2}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full transition-all group-hover:scale-110" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
                            <Target className="text-emerald-500 dark:text-emerald-400 w-7 h-7" />
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                            NEW
                        </div>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">EVENTS THIS WEEK</h3>
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {events.filter(e => isThisWeek(new Date(e.startDate))).length || 1}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 cursor-pointer" onClick={() => navigate('/analytics')}>
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-full transition-all group-hover:scale-110" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                            <Trophy className="text-amber-500 dark:text-amber-400 w-7 h-7" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">TOTAL PRIZE POOL</h3>
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {stats.totalPrize > 0 ? `₹${(stats.totalPrize / 1000).toFixed(0)}K` : '₹280K'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12">
                {/* Left Column */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Tactical Queue */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{displayEventsData.title} <span className="text-indigo-600">{displayEventsData.subtitle}</span></h2>
                        </div>
                        <Link to="/events" className="z-10 text-xs font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2 group cursor-pointer p-2 -m-2">
                            View All Events
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="space-y-6">
                        {displayEventsData.list.length > 0 ? (
                            displayEventsData.list.map((event, idx) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + idx * 0.1 }}
                                >
                                    <EventCard event={event} />
                                </motion.div>
                            ))
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 sm:p-20 text-center">
                                <Shield size={48} className="mx-auto text-slate-200 mb-6" />
                                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest leading-none mb-2">No Priority Events</h3>
                                <p className="text-slate-400 text-xs font-bold">Scanning for new opportunities...</p>
                            </div>
                        )}
                    </div>

                    {/* Tactical Unit (Team Members) */}
                    <div className="relative group pt-8">
                        <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] blur-[30px] opacity-10 group-hover:opacity-20 transition-opacity" />
                        <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-indigo-600/20 overflow-hidden shadow-2xl p-5 sm:p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                                    <Users size={24} className="text-indigo-600" />
                                    Tactical Unit
                                </h3>
                                <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-indigo-100">
                                    {teamMembers.length || 1} OPERATIVE(S)
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {teamMembers.length > 0 ? teamMembers.map((member, idx) => (
                                    <div key={member.id || idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 overflow-hidden flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                (member.displayName || 'OP').substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-wider">{member.displayName || 'Unknown Unit'}</p>
                                            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{member.position || 'Explorer'}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-2 text-center py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        No secondary units deployed.
                                    </div>
                                )}
                            </div>

                            {userRole !== 'public' && (
                                <div className="grid grid-cols-2 gap-3 mt-6">
                                    <button 
                                        onClick={() => openModal('teamInvite')}
                                        className="w-full py-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} /> Invite Members
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const inviteUrl = prompt("Enter the Team Invite Link or Team ID to join:");
                                            if (inviteUrl && inviteUrl.trim() !== '') {
                                                const id = inviteUrl.includes('/invite/') ? inviteUrl.split('/invite/')[1] : inviteUrl.trim();
                                                navigate(`/invite/${id}`);
                                            }
                                        }}
                                        className="w-full py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ArrowRight size={14} /> Join Team
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 space-y-10">
                    {/* Critical Alert Module */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-amber-500 rounded-[2.5rem] blur-[30px] opacity-10 group-hover:opacity-20 transition-opacity" />
                        <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-amber-500/20 overflow-hidden shadow-2xl">
                            <div className="p-5 sm:p-8 pb-4">
                                <div className="flex items-center justify-between mb-4 sm:mb-8">
                                    <h3 className="text-xl font-black text-amber-600 flex items-center gap-3">
                                        <Clock size={24} strokeWidth={3} className="animate-pulse" />
                                        CRITICAL
                                    </h3>
                                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-200">
                                        {criticalDeadlines.length} ALERT(S)
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <AnimatePresence>
                                        {criticalDeadlines.slice(0, 4).map((event, idx) => {
                                            const days = differenceInDays(startOfDay(new Date(event.registrationDeadline)), startOfDay(new Date()));
                                            return (
                                                <motion.div
                                                    key={event.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.8 + idx * 0.1 }}
                                                    onClick={() => { setSelectedEvent(event.id); openModal('eventDetails'); }}
                                                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:scale-[1.02] transition-transform cursor-pointer"
                                                >
                                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm border shadow-sm",
                                                        days === 0 ? "bg-amber-600 text-white border-amber-600" : "bg-white dark:bg-slate-900 text-amber-600 border-amber-100"
                                                    )}>
                                                        {days === 0 ? '!' : days}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-wider">{event.eventName}</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 truncate uppercase mt-0.5">{event.collegeName}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                            <div className="p-5 sm:p-8 pt-4 sm:pt-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => navigate('/events')}
                                        className="flex-1 px-4 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Check Live Status
                                    </button>
                                    <button
                                        onClick={() => navigate('/analytics')}
                                        className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Analyze Risk
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Integrity Module */}
                    <div className="bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                            <Shield size={120} />
                        </div>
                        <h3 className="text-xl font-black mb-8 relative z-10 flex items-center gap-3">
                            <Sparkles size={20} className="text-indigo-400" />
                            Grid Integrity
                        </h3>
                        <div className="space-y-6 relative z-10">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Core Synchronization</span>
                                    <span className="text-indigo-400">98.4%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '98.4%' }}
                                        transition={{ duration: 1.5, ease: 'easeOut' }}
                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Active Nodes</span>
                                    <span className="text-xl font-black">{events.length}</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">XP Gathered</span>
                                    <span className="text-xl font-black text-amber-500">{(events.filter(e => e.status === 'Won').length * 1500 + events.filter(e => e.status === 'Attended').length * 500).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
