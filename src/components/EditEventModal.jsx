import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { db, updateEvent, EventType, EventStatus } from '../db';
import { X, Save, Sparkles, Image as ImageIcon, Link as LinkIcon, Calendar, Trophy, MapPin, Users, Phone, User, Info, Check } from 'lucide-react';
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
// Uses local time to prevent "previous day" shift
const formatDateForInput = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    // Adjust for timezone offset to ensure we get the local YYYY-MM-DD
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
};

const EditEventModal = () => {
    const modals = useAppStore((state) => state.modals);
    const closeModal = useAppStore((state) => state.closeModal);
    const selectedEvent = useAppStore((state) => state.selectedEvent);
    const isOpen = modals.editEvent;
    const modalRef = useRef(null);

    const event = useLiveQuery(
        () => selectedEvent ? db.events.get(selectedEvent) : null,
        [selectedEvent]
    );

    const [formData, setFormData] = useState({
        collegeName: '',
        eventName: '',
        eventType: EventType.HACKATHON,
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
        status: '',
        contact1: '',
        contact2: '',
        leader: '',
        members: '',
        noOfTeams: '',
        prizeWon: '',
        teamName: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'logistics', 'team', 'media'

    useEffect(() => {
        if (event) {
            setFormData({
                collegeName: event.collegeName || '',
                eventName: event.eventName || '',
                eventType: event.eventType || EventType.HACKATHON,
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
                teamName: event.teamName || ''
            });
        }
    }, [event]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
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
            const updates = {
                ...formData,
                prizeAmount: parseFloat(formData.prizeAmount) || 0,
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

    return (
        <AnimatePresence>
            {isOpen && event && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        onClick={() => closeModal('editEvent')}
                    />

                    <motion.div
                        layoutId="editModal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-[95%] sm:max-w-2xl lg:max-w-4xl bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
                    >
                {/* Header Section */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-4 sm:p-8">
                        <button
                            onClick={() => closeModal('editEvent')}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all border border-white/20"
                        >
                            <X size={18} className="sm:size-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 mb-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Sparkles size={20} className="sm:size-6 text-indigo-200" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-black tracking-tight">Edit <span className="text-indigo-200 uppercase text-[10px] sm:text-sm font-black tracking-[0.2em] ml-2">Event</span></h2>
                            <p className="opacity-70 text-[10px] sm:text-sm font-semibold tracking-wide truncate max-w-[200px] sm:max-w-md">Updating {event.eventName}</p>
                        </div>
                    </div>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 px-4 sm:px-8 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all shrink-0",
                                        isActive
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 -translate-y-0.5 sm:-translate-y-1"
                                            : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <Icon size={12} className="sm:size-3.5" strokeWidth={3} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-8"
                            >
                                {activeTab === 'basic' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Event Name</label>
                                                <input type="text" name="eventName" value={formData.eventName} onChange={handleChange} required className="input-premium" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">College Name</label>
                                                <input type="text" name="collegeName" value={formData.collegeName} onChange={handleChange} required className="input-premium" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="form-group">
                                                    <label className="label-premium">Category</label>
                                                    <select name="eventType" value={formData.eventType} onChange={handleChange} required className="input-premium">
                                                        {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label-premium">Status</label>
                                                    <select name="status" value={formData.status} onChange={handleChange} className="input-premium">
                                                        {Object.values(EventStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Calendar size={18} className="text-indigo-600" />
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Event Timeline</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="form-group">
                                                    <label className="label-premium text-[10px]">Registration Deadline</label>
                                                    <input type="date" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} required className="input-premium bg-white dark:bg-slate-900" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="form-group">
                                                        <label className="label-premium text-[10px]">Start Date</label>
                                                        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className="input-premium bg-white dark:bg-slate-900" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="label-premium text-[10px]">End Date</label>
                                                        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required className="input-premium bg-white dark:bg-slate-900" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'logistics' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="form-group">
                                                    <label className="label-premium">Grand Prize (₹)</label>
                                                    <div className="relative">
                                                        <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
                                                        <input type="number" name="prizeAmount" value={formData.prizeAmount} onChange={handleChange} className="input-premium pl-12 text-lg font-black text-amber-600" placeholder="0" />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label-premium">Registration Fee (₹)</label>
                                                    <input type="number" name="registrationFee" value={formData.registrationFee} onChange={handleChange} className="input-premium" placeholder="0" />
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="form-group">
                                                    <label className="label-premium">Venue / Coordinates</label>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                                                        <input type="text" name="location" value={formData.location} onChange={handleChange} className="input-premium pl-12" placeholder="Venue Name" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-3 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-all border-2 border-transparent has-[:checked]:border-indigo-600 group">
                                                        <input type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange} className="hidden" />
                                                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.isOnline ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                            {formData.isOnline && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Remote / Online</span>
                                                    </label>
                                                    <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-3 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-all border-2 border-transparent has-[:checked]:border-indigo-600 group">
                                                        <input type="checkbox" name="accommodation" checked={formData.accommodation} onChange={handleChange} className="hidden" />
                                                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.accommodation ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                            {formData.accommodation && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Stay Provided</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Eligibility / Criteria</label>
                                            <textarea name="eligibility" value={formData.eligibility} onChange={handleChange} rows="2" className="input-premium resize-none pt-4" placeholder="Who can participate? e.g. 'Engineering Students Only'"></textarea>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Description</label>
                                            <textarea name="description" value={formData.description} onChange={handleChange} rows="4" className="input-premium min-h-[120px] resize-none pt-4" placeholder="Brief about the event..."></textarea>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'team' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="form-group">
                                                    <label className="label-premium">Team Leader Name</label>
                                                    <div className="relative">
                                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                                                        <input type="text" name="leader" value={formData.leader} onChange={handleChange} className="input-premium pl-12" placeholder="Leader Name" />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label-premium">Team Members</label>
                                                    <div className="relative">
                                                        <Users className="absolute left-4 top-[1.25rem] text-indigo-500" size={18} />
                                                        <textarea name="members" value={formData.members} onChange={handleChange} rows="2" className="input-premium pl-12 pt-4 resize-none" placeholder="Member Names (comma separated)"></textarea>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="form-group">
                                                    <label className="label-premium">Team Size</label>
                                                    <input type="number" name="teamSize" value={formData.teamSize} onChange={handleChange} className="input-premium" min="1" />
                                                </div>
                                                {parseInt(formData.teamSize) > 1 && (
                                                    <div className="form-group">
                                                        <label className="label-premium">Team Name</label>
                                                        <input type="text" name="teamName" value={formData.teamName} onChange={handleChange} className="input-premium" placeholder="e.g. The Avengers" />
                                                    </div>
                                                )}
                                                <div className="form-group">
                                                    <label className="label-premium">Teams from Dept</label>
                                                    <input type="text" name="noOfTeams" value={formData.noOfTeams} onChange={handleChange} className="input-premium" placeholder="e.g. 2 Teams" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 bg-slate-900 rounded-3xl text-white">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Phone size={18} className="text-indigo-400" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Contact Details</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input type="text" name="contact1" value={formData.contact1} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-5 py-3 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Priority Contact" />
                                                <input type="text" name="contact2" value={formData.contact2} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-5 py-3 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Secondary Contact" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'media' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Visual Asset (Poster)</label>
                                                <PreviewImage blob={formData.posterBlob} url={formData.posterUrl} />
                                                <div className="mt-4 flex gap-4">
                                                    <label className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest text-center cursor-pointer hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
                                                        Upload File
                                                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, posterBlob: null }))}
                                                        className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200 dark:border-slate-700"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Remote Asset URL</label>
                                                <div className="relative">
                                                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input type="url" name="posterUrl" value={formData.posterUrl} onChange={handleChange} className="input-premium pl-12 text-xs" placeholder="https://cdn.example.com/poster.jpg" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Website Link</label>
                                                <div className="relative">
                                                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                                                    <input type="url" name="website" value={formData.website} onChange={handleChange} className="input-premium pl-12" placeholder="Official Website URL" />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Registration Link</label>
                                                <div className="relative">
                                                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                                                    <input type="url" name="registrationLink" value={formData.registrationLink} onChange={handleChange} className="input-premium pl-12" placeholder="Google Form / Registration Link" />
                                                </div>
                                            </div>
                                            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] border-2 border-dashed border-indigo-200 dark:border-indigo-800">
                                                <div className="flex flex-col items-center text-center">
                                                    <Sparkles className="text-indigo-600 mb-3" size={32} />
                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mb-2">Smart Discovery Tip</h4>
                                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">Ensure the website URL is correct. The system uses this to fetch real-time updates for your squad.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => closeModal('editEvent')}
                            className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 border border-white/20"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            Save Changes
                        </button>
                    </div>
                </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default EditEventModal;
