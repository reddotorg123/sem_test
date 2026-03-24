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
        eventTypes: [],
        customEventType: '',
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
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        if (event) {
            // Parse eventType string into array
            const typeStr = event.eventType || '';
            const types = typeStr.split(',').map(t => t.trim()).filter(Boolean);
            
            // Identify custom types that are not in EventType enum
            const predefinedValues = Object.values(EventType);
            const identifiedPredefined = types.filter(t => predefinedValues.includes(t));
            const identifiedCustom = types.filter(t => !predefinedValues.includes(t));

            setFormData({
                collegeName: event.collegeName || '',
                eventName: event.eventName || '',
                eventTypes: identifiedCustom.length > 0 ? [...identifiedPredefined, 'Other'] : identifiedPredefined,
                customEventType: identifiedCustom.join(', '),
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

    const toggleEventType = (type) => {
        setFormData(prev => {
            const current = prev.eventTypes || [];
            if (current.includes(type)) {
                return { ...prev, eventTypes: current.filter(t => t !== type) };
            } else {
                return { ...prev, eventTypes: [...current, type] };
            }
        });
    };

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
            // Handle multiple types and custom types
            let finalTypesArr = [...(formData.eventTypes || [])];
            if (finalTypesArr.includes('Other') && formData.customEventType.trim()) {
                finalTypesArr = finalTypesArr.map(t => t === 'Other' ? formData.customEventType.trim() : t);
            }
            const actualEventType = finalTypesArr.join(', ');

            const updates = {
                ...formData,
                eventType: actualEventType,
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
        <AnimatePresence>
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

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
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

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
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
                                        <div className="form-group">
                                            <label className="label-premium">Categories (Select Multiple)</label>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {Object.values(EventType).map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => toggleEventType(type)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                                                            formData.eventTypes?.includes(type) 
                                                                ? "bg-indigo-600 text-white border-indigo-600" 
                                                                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
                                                        )}
                                                    >
                                                        <div className={cn("w-3 h-3 rounded-full border border-current flex items-center justify-center", formData.eventTypes?.includes(type) ? "bg-white" : "")}>
                                                            {formData.eventTypes?.includes(type) && <Check size={8} className="text-indigo-600" strokeWidth={5} />}
                                                        </div>
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                            {formData.eventTypes?.includes('Other') && (
                                                <input 
                                                    type="text" 
                                                    name="customEventType" 
                                                    value={formData.customEventType} 
                                                    onChange={handleChange} 
                                                    className="input-premium mt-3" 
                                                    placeholder="Specify Other Category..." 
                                                />
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Status</label>
                                            <select name="status" value={formData.status} onChange={handleChange} className="input-premium">
                                                {Object.values(EventStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Calendar size={18} className="text-indigo-600" />
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Timeline</span>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium text-[10px]">Registration Deadline</label>
                                            <input type="date" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} required className="input-premium" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="form-group">
                                                <label className="label-premium text-[10px]">Start Date</label>
                                                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className="input-premium" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium text-[10px]">End Date</label>
                                                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required className="input-premium" />
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
                                                <label className="label-premium">Prize Won (₹)</label>
                                                <div className="relative">
                                                    <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                                                    <input type="number" name="prizeWon" value={formData.prizeWon} onChange={handleChange} className="input-premium pl-12 text-lg font-black text-emerald-600" placeholder="0" />
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
                                                <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-3 rounded-xl hover:bg-white transition-all">
                                                    <input type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange} className="hidden" />
                                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.isOnline ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                        {formData.isOnline && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase text-slate-600">Online</span>
                                                </label>
                                                <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer py-3 rounded-xl hover:bg-white transition-all">
                                                    <input type="checkbox" name="accommodation" checked={formData.accommodation} onChange={handleChange} className="hidden" />
                                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", formData.accommodation ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                                                        {formData.accommodation && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase text-slate-600">Stay</span>
                                                </label>
                                            </div>
                                        </div>
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
                                                    <input type="text" name="leader" value={formData.leader} onChange={handleChange} className="input-premium pl-12" />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Team Members</label>
                                                <textarea name="members" value={formData.members} onChange={handleChange} rows="2" className="input-premium pt-4" placeholder="Member Names"></textarea>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Team Size</label>
                                                <input type="number" name="teamSize" value={formData.teamSize} onChange={handleChange} className="input-premium" min="1" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Team Name</label>
                                                <input type="text" name="teamName" value={formData.teamName} onChange={handleChange} className="input-premium" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-slate-900 rounded-3xl text-white">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Phone size={18} className="text-indigo-400" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Contacts</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input type="text" name="contact1" value={formData.contact1} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-5 py-3 text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Contact 1" />
                                            <input type="text" name="contact2" value={formData.contact2} onChange={handleChange} className="bg-slate-800 border-0 rounded-2xl px-5 py-3 text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Contact 2" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'media' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Visual Asset</label>
                                            <PreviewImage blob={formData.posterBlob} url={formData.posterUrl} />
                                            <div className="mt-4 flex gap-4">
                                                <label className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest text-center cursor-pointer">
                                                    Update File
                                                    <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Poster URL (Remote)</label>
                                            <input type="url" name="posterUrl" value={formData.posterUrl} onChange={handleChange} className="input-premium" />
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="form-group">
                                            <label className="label-premium">Website</label>
                                            <input type="url" name="website" value={formData.website} onChange={handleChange} className="input-premium" />
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Registration Link</label>
                                            <input type="url" name="registrationLink" value={formData.registrationLink} onChange={handleChange} className="input-premium" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <button type="button" onClick={() => closeModal('editEvent')} className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl flex items-center gap-3">
                                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                                Update Record
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EditEventModal;
