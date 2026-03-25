import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { db, updateEvent, EventType, EventStatus } from '../db';
import { X, Save, Sparkles, Image as ImageIcon, Link as LinkIcon, Calendar, Trophy, MapPin, Users, Phone, User, Info, Check, Clock } from 'lucide-react';
import { cn } from '../utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';

const PreviewImage = ({ blob, url }) => {
    const [displayUrl, setDisplayUrl] = useState(null);

    useEffect(() => {
        if (blob instanceof Blob) {
            const newUrl = URL.createObjectURL(blob);
            setDisplayUrl(newUrl);
            return () => URL.revokeObjectURL(newUrl);
        } else if (url) {
            setDisplayUrl(url);
        } else {
            setDisplayUrl(null);
        }
    }, [blob, url]);

    if (!displayUrl) return (
        <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
            <ImageIcon size={32} className="text-slate-300 mb-2" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Image Preview</span>
        </div>
    );

    return (
        <div className="relative group overflow-hidden rounded-2xl shadow-xl">
            <img src={displayUrl} alt="Preview" className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-900 border border-white">Current Selection</span>
            </div>
        </div>
    );
};

// Helper: Format date for input[type="date"] (YYYY-MM-DD)
const formatDateForInput = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
};

const EditEventModal = () => {
    const modals = useAppStore((state) => state.modals);
    const closeModal = useAppStore((state) => state.closeModal);
    const selectedEvent = useAppStore((state) => state.selectedEvent);
    const isOpen = modals.editEvent;

    const event = useLiveQuery(
        () => selectedEvent ? db.events.get(selectedEvent) : null,
        [selectedEvent]
    );

    const [formData, setFormData] = useState({
        collegeName: '',
        eventName: '',
        eventType: [EventType.HACKATHON],
        registrationDeadline: '',
        startDate: '',
        endDate: '',
        prizeAmount: '',
        registrationFee: '',
        accommodation: false,
        location: '',
        isOnline: false,
        contactNumbers: '',
        posterUrl: '',
        posterBlob: null,
        website: '',
        registrationLink: '',
        description: '',
        teamSize: '1',
        eligibility: '',
        status: 'Open',
        contact1: '',
        contact2: '',
        leader: '',
        members: '',
        noOfTeams: '',
        prizeWon: '',
        teamName: '',
        customEventType: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        if (event) {
            const currentTypes = Array.isArray(event.eventType) ? event.eventType : (event.eventType ? [event.eventType] : [EventType.HACKATHON]);
            const isCustom = currentTypes.some(t => !Object.values(EventType).includes(t));
            const customVal = isCustom ? currentTypes.find(t => !Object.values(EventType).includes(t)) : '';
            
            // Map custom types back to 'Other' in the checkboxes if needed, or just handle them as is
            // For now, let's just make sure 'Other' is checked if there's a custom type
            const finalTypes = currentTypes.map(t => Object.values(EventType).includes(t) ? t : EventType.OTHER);
            // Remove duplicates (e.g. if 'Other' was already there)
            const uniqueTypes = [...new Set(finalTypes)];

            setFormData({
                collegeName: event.collegeName || '',
                eventName: event.eventName || '',
                eventType: uniqueTypes,
                registrationDeadline: event.registrationDeadline ? formatDateForInput(event.registrationDeadline) : '',
                startDate: event.startDate ? formatDateForInput(event.startDate) : '',
                endDate: event.endDate ? formatDateForInput(event.endDate) : '',
                prizeAmount: event.prizeAmount || '',
                registrationFee: event.registrationFee || '',
                accommodation: !!event.accommodation,
                location: event.location || '',
                isOnline: !!event.isOnline,
                contactNumbers: Array.isArray(event.contactNumbers) ? event.contactNumbers.join(', ') : '',
                posterUrl: event.posterUrl || '',
                posterBlob: event.posterBlob || null,
                website: event.website || '',
                registrationLink: event.registrationLink || '',
                description: event.description || '',
                teamSize: event.teamSize || '1',
                eligibility: event.eligibility || '',
                status: event.status || 'Open',
                contact1: event.contact1 || '',
                contact2: event.contact2 || '',
                leader: event.leader || '',
                members: event.members || '',
                noOfTeams: event.noOfTeams || '',
                prizeWon: event.prizeWon || '',
                teamName: event.teamName || '',
                customEventType: customVal || ''
            });
        }
    }, [event]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setActiveTab('basic');
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, posterBlob: e.target.files[0] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const actualEventTypes = formData.eventType.map(t => 
                (t === EventType.OTHER && formData.customEventType.trim()) ? formData.customEventType.trim() : t
            );

            const updates = {
                ...formData,
                eventType: actualEventTypes,
                prizeAmount: parseFloat(formData.prizeAmount) || 0,
                prizeWon: parseFloat(formData.prizeWon) || 0,
                registrationFee: parseFloat(formData.registrationFee) || 0,
                teamSize: parseInt(formData.teamSize) || 1,
                contactNumbers: formData.contactNumbers.split(',').map(c => c.trim()).filter(Boolean),
                registrationDeadline: new Date(formData.registrationDeadline),
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate)
            };

            await updateEvent(selectedEvent, updates);
            closeModal('editEvent');
        } catch (error) {
            console.error('ERROR UPDATING EVENT:', error);
            alert(`System Error: ${error.message || 'Unknown database error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'General', icon: Info },
        { id: 'logistics', label: 'Logistics', icon: MapPin },
        { id: 'team', label: 'Team Info', icon: Users },
        { id: 'media', label: 'Poster & Web', icon: ImageIcon }
    ];

    if (!isOpen || !event) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                onClick={() => closeModal('editEvent')}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-[95%] sm:max-w-2xl lg:max-w-4xl bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-4 sm:p-8">
                        <button
                            onClick={() => closeModal('editEvent')}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all border border-white/20"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Sparkles size={24} className="text-indigo-200" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">Update Record</h2>
                            <p className="opacity-70 text-xs font-bold tracking-widest uppercase">Target ID: {String(selectedEvent).substring(0, 8)}...</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 px-4 sm:px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 border",
                                        isActive
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30 -translate-y-1"
                                            : "text-slate-500 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <Icon size={14} strokeWidth={3} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10">
                        {activeTab === 'basic' && (
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Event Name</label>
                                            <input type="text" name="eventName" value={formData.eventName} onChange={handleChange} required className="input-premium" />
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">College Name</label>
                                            <input type="text" name="collegeName" value={formData.collegeName} onChange={handleChange} required className="input-premium" />
                                        </div>
                                        <div className="form-group col-span-2">
                                            <label className="label-premium">Event Categories</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                                {Object.values(EventType).map(t => (
                                                    <label key={t} className={cn(
                                                        "flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-[9px] font-black uppercase tracking-wider",
                                                        formData.eventType.includes(t) 
                                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20" 
                                                            : "bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-indigo-300"
                                                    )}>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden" 
                                                            checked={formData.eventType.includes(t)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    eventType: checked ? [...prev.eventType, t] : prev.eventType.filter(x => x !== t)
                                                                }));
                                                            }}
                                                        />
                                                        {t}
                                                    </label>
                                                ))}
                                            </div>
                                            {formData.eventType.includes(EventType.OTHER) && (
                                                <input 
                                                    type="text" 
                                                    name="customEventType" 
                                                    value={formData.customEventType} 
                                                    onChange={handleChange} 
                                                    className="input-premium mt-3" 
                                                    placeholder="Specify Custom Type" 
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-8">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="text-indigo-600" size={20} />
                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Timeline & Status</span>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="form-group">
                                                <label className="label-premium text-[10px]">Current Status</label>
                                                <select name="status" value={formData.status} onChange={handleChange} className="input-premium">
                                                    {Object.values(EventStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium text-[10px]">Reg. Deadline</label>
                                                <input type="date" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} required className="input-premium" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="form-group">
                                                    <label className="label-premium text-[10px]">Starts</label>
                                                    <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className="input-premium" />
                                                </div>
                                                <div className="form-group">
                                                    <label className="label-premium text-[10px]">Ends</label>
                                                    <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required className="input-premium" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'logistics' && (
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Grand Prize (₹)</label>
                                            <div className="relative">
                                                <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={20} />
                                                <input type="number" name="prizeAmount" value={formData.prizeAmount} onChange={handleChange} className="input-premium pl-12 text-lg font-black" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Prize Won (₹)</label>
                                            <div className="relative">
                                                <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                                                <input type="number" name="prizeWon" value={formData.prizeWon} onChange={handleChange} className="input-premium pl-12 text-lg font-black" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Registration Fee (₹)</label>
                                            <input type="number" name="registrationFee" value={formData.registrationFee} onChange={handleChange} className="input-premium" />
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Location / Venue</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                <input type="text" name="location" value={formData.location} onChange={handleChange} className="input-premium pl-12" />
                                            </div>
                                        </div>
                                        <div className="flex gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-4 rounded-2xl hover:bg-white dark:hover:bg-slate-900 transition-all border-2 border-transparent has-[:checked]:border-indigo-600">
                                                <input type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange} className="hidden" />
                                                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.isOnline ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                    {formData.isOnline && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Online</span>
                                            </label>
                                            <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-4 rounded-2xl hover:bg-white dark:hover:bg-slate-900 transition-all border-2 border-transparent has-[:checked]:border-indigo-600">
                                                <input type="checkbox" name="accommodation" checked={formData.accommodation} onChange={handleChange} className="hidden" />
                                                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.accommodation ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                    {formData.accommodation && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Stay</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="label-premium">Eligibility Description</label>
                                    <textarea name="eligibility" value={formData.eligibility} onChange={handleChange} rows="2" className="input-premium pt-4" />
                                </div>
                                <div className="form-group">
                                    <label className="label-premium">Full Event Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows="5" className="input-premium pt-4" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Lead / POC Name</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                <input type="text" name="leader" value={formData.leader} onChange={handleChange} className="input-premium pl-12" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Squad Members</label>
                                            <div className="relative">
                                                <Users className="absolute left-4 top-6 text-indigo-500" size={20} />
                                                <textarea name="members" value={formData.members} onChange={handleChange} rows="2" className="input-premium pl-12 pt-4" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Team Size</label>
                                            <input type="number" name="teamSize" value={formData.teamSize} onChange={handleChange} className="input-premium" min="1" />
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Department Alias</label>
                                            <input type="text" name="noOfTeams" value={formData.noOfTeams} onChange={handleChange} className="input-premium" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Phone size={24} className="text-indigo-400" />
                                        <h3 className="text-lg font-black uppercase tracking-widest text-indigo-300">Contact Network</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <input type="text" name="contact1" value={formData.contact1} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-6 py-4 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Comm Link 1" />
                                        <input type="text" name="contact2" value={formData.contact2} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-6 py-4 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Comm Link 2" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'media' && (
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium text-[11px] font-black uppercase tracking-widest mb-4 block">Visual Protocol (Poster)</label>
                                            <PreviewImage blob={formData.posterBlob} url={formData.posterUrl} />
                                            <div className="mt-6 flex gap-3">
                                                <label className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center cursor-pointer hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                                                    Inject Media
                                                    <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, posterBlob: null }))}
                                                    className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                                                >
                                                    Flush
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Neural Link 1 (Website)</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                <input type="url" name="website" value={formData.website} onChange={handleChange} className="input-premium pl-12" placeholder="https://..." />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Neural Link 2 (Registration)</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" size={20} />
                                                <input type="url" name="registrationLink" value={formData.registrationLink} onChange={handleChange} className="input-premium pl-12" placeholder="https://..." />
                                            </div>
                                        </div>
                                        <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border-2 border-dashed border-indigo-200 dark:border-indigo-800/50">
                                            <div className="flex flex-col items-center text-center">
                                                <Clock className="text-indigo-600 mb-4" size={32} />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-3">Sync Status</h4>
                                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-4">Changes made here are instantly replicated across the squad's tactical matrix via Neural Layer 1 (IndexedDB).</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-10 py-8 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => closeModal('editEvent')}
                            className="px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                        >
                            Abort Task
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-12 py-5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl font-black text-[14px] uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-4 border border-white/20"
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={20} />
                            )}
                            Finalize Update
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default EditEventModal;
