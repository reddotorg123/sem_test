import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import { useAppStore } from '../store';
import EventCard from './EventCard';
import { TrendingUp, Calendar, Clock, Trophy, Plus, FileUp, Zap, Sparkles, Shield, Bell, Target, ArrowRight, Users, User, Crown, Send, LogOut, MessageSquare, Edit2, Check, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, isToday, isThisWeek, differenceInDays, startOfDay, addDays, isAfter, isBefore } from 'date-fns';
import { cn } from '../utils';
import { getTeamMembers, leaveTeam, sendTeamMessage, subscribeToTeamMessages, updateMemberPosition, addNotification, getUserData } from '../services/firebase';

const StatCard = ({ title, value, icon: Icon, color, delay, trend, onClick }) => {
    const colorClasses = {
        'bg-indigo-500': { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
        'bg-violet-500': { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },
        'bg-emerald-500': { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
        'bg-amber-500': { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' }
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
            <div className="absolute inset-0 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm group-hover:shadow-indigo-500/10 transition-all duration-500" />
            <div className="relative p-6 h-full flex flex-col justify-between overflow-hidden rounded-[2rem]">
                <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-all duration-700 group-hover:scale-150 group-hover:opacity-20", color)} />
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", styles.bg)}>
                        <Icon className={cn("w-6 h-6", styles.text)} />
                    </div>
                    {trend && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                            <TrendingUp size={10} /> {trend}
                        </div>
                    )}
                </div>
                <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{title}</h3>
                    <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
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
    const openModal = useAppStore((state) => state.openModal);
    const [teamMembers, setTeamMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [activeTeamId, setActiveTeamId] = useState(null);
    const msgEndRef = useRef(null);

    // Sync activeTeamId when user or teamId state changes
    useEffect(() => {
        if (user) {
            setActiveTeamId(teamId || user.uid);
        }
    }, [teamId, user]);

    // Fetch Team Members & Messages
    useEffect(() => {
        if (activeTeamId) {
            let unsubscribeMembers = () => {};
            getTeamMembers(activeTeamId).then(members => setTeamMembers(members));
            
            const unsubscribeMessages = subscribeToTeamMessages(activeTeamId, (msgs) => {
                setMessages(msgs);
            });

            return () => {
                if (unsubscribeMessages) unsubscribeMessages();
            };
        }
    }, [activeTeamId]);

    // Scroll to bottom when messages or chat state change
    useEffect(() => {
        if (isChatOpen && msgEndRef.current) {
            msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isChatOpen]);

    const events = useLiveQuery(async () => {
        const { getMergedEvents } = await import('../db');
        return await getMergedEvents();
    }, [activeTeamId]) || [];

    const upcomingEvents = useMemo(() => {
        const now = startOfDay(new Date());
        return events.filter(e => {
            const date = new Date(e.endDate || e.startDate || e.registrationDeadline);
            return !isNaN(date.getTime()) && !isBefore(startOfDay(date), now);
        });
    }, [events]);

    const stats = useMemo(() => {
        const total = events.length;
        const upcomingCount = upcomingEvents.length;
        const prizeValues = upcomingEvents.map(e => parseFloat(String(e.prizeAmount).replace(/[^0-9.]/g, '')) || 0);
        const totalPrize = prizeValues.reduce((a, b) => a + b, 0);
        const winCount = events.filter(e => e.status === 'Won').length;
        return { total, upcomingCount, totalPrize, winCount };
    }, [events, upcomingEvents]);

    const handleLeaveTeam = async () => {
        if (!window.confirm("Are you sure you want to leave this team?")) return;
        try {
            await leaveTeam(user.uid);
            await addNotification(user.uid, {
                title: 'Tactical Realignment',
                content: `You have returned to your personal workspace.`,
                type: 'info'
            });
            window.location.reload(); 
        } catch (err) { alert(err.message); }
    };

    const handleJoinTeam = async () => {
        const targetTeamId = window.prompt("Enter Target Tactical Unit ID:");
        if (targetTeamId) navigate(`/invite/${targetTeamId}`);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeTeamId || !user) return;
        try {
            await sendTeamMessage(activeTeamId, user.uid, user.displayName || user.email?.split('@')[0] || 'Unknown', newMessage);
            setNewMessage('');
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Intel Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <StatCard title="Upcoming Ops" value={stats.upcomingCount} icon={Calendar} color="bg-indigo-500" delay={0.1} trend="+12% vs Phase 1" />
                <StatCard title="Captured Bounty" value={`₹${stats.totalPrize.toLocaleString()}`} icon={Trophy} color="bg-amber-500" delay={0.2} trend="+₹50k Intel" />
                <StatCard title="Total Signals" value={stats.total} icon={Zap} color="bg-violet-500" delay={0.3} />
                <StatCard title="Confirmed Wins" value={stats.winCount} icon={Shield} color="bg-emerald-500" delay={0.4} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Events */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Target size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">Active <span className="text-indigo-600">Operations</span></h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tier 1 Priority List</p>
                            </div>
                        </div>
                        {userRole === 'admin' || userRole === 'event_manager' ? (
                            <button onClick={() => openModal('addEvent')} className="h-12 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2">
                                <Plus size={16} /> Deploy New Event
                            </button>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {upcomingEvents.slice(0, 4).map((event, index) => (
                            <EventCard key={event.id} event={event} index={index} />
                        ))}
                    </div>

                    {upcomingEvents.length > 4 && (
                        <Link to="/events" className="group flex items-center justify-center gap-3 py-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-indigo-600 transition-colors">Access Full Database</span>
                            <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
                        </Link>
                    )}
                </div>

                {/* Right Column: Team Intelligence */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Unit Roster</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{activeTeamId === user?.uid ? 'Solo Infiltration' : 'Tactical Unit'}</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">{teamMembers.length} Active</span>
                        </div>

                        <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2 mb-8">
                            {teamMembers.map((member) => (
                                <div key={member.id} className="flex items-center gap-4 p-3 rounded-[1.2rem] bg-slate-50 dark:bg-slate-800/40 hover:scale-[1.02] transition-transform">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                        <User size={18} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{member.displayName || 'Unknown'}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{member.position || 'Explorer'}</p>
                                    </div>
                                    {member.id === activeTeamId && <Crown size={14} className="text-amber-500" strokeWidth={3} />}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {user?.uid !== teamId ? (
                                <button onClick={handleLeaveTeam} className="w-full py-4 bg-rose-50 dark:bg-rose-900/40 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2">
                                    <LogOut size={14} /> Leave Team
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-2 col-span-1">
                                    <button onClick={handleJoinTeam} className="py-4 px-4 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 flex-1">
                                        <Users size={12} /> Join Unit
                                    </button>
                                     <button onClick={() => openModal('teamInvite')} className="py-4 px-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 flex-1 border border-indigo-100">
                                        <Plus size={12} /> Invite
                                    </button>
                                </div>
                            )}
                            <button 
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                className={cn(
                                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                                    isChatOpen ? "bg-slate-900 text-white shadow-xl" : "bg-slate-50 dark:bg-slate-800 text-slate-600"
                                )}
                            >
                                <MessageSquare size={14} /> {isChatOpen ? 'Close Intel' : 'Team Intel'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {isChatOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] p-4 flex flex-col h-[350px]">
                                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
                                            {messages.length > 0 ? messages.map((msg, i) => (
                                                <div key={msg.id || i} className={cn("flex flex-col", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                                                    <div className="flex items-center gap-2 mb-1 px-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{msg.senderName}</span>
                                                        <span className="text-[7px] text-slate-500 uppercase">{msg.dateObject ? format(msg.dateObject, 'HH:mm') : 'Sync...'}</span>
                                                    </div>
                                                    <div className={cn("px-4 py-2.5 rounded-[1.2rem] text-xs font-bold max-w-[90%] shadow-sm", msg.senderId === user?.uid ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-tl-none border border-slate-100 dark:border-slate-800")}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                                    <MessageSquare size={24} />
                                                    <p className="text-[8px] font-black uppercase tracking-widest mt-2">Clear Channel</p>
                                                </div>
                                            )}
                                            <div ref={msgEndRef} />
                                        </div>
                                        <form onSubmit={handleSendMessage} className="relative">
                                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Transmission signal..." className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl pl-5 pr-14 py-4 text-xs font-bold outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300" />
                                            <button type="submit" disabled={!newMessage.trim()} className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-0 disabled:scale-90">
                                                <Send size={16} strokeWidth={3} />
                                            </button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
