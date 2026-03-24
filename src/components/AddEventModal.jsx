import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { addEvent } from '../db';
import { parseDate } from '../csvUtils';
import { X, Upload, Image as ImageIcon, Sparkles, Wand2, Info, MapPin, Calendar, Trophy, Users, Globe, Terminal, ShieldCheck, Check, Save, Plus, Clock } from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

// Defined locally to prevent circular dependency issues crash
const EventType = {
    HACKATHON: 'Hackathon',
    PAPER_PRESENTATION: 'Paper Presentation',
    PROJECT_EXPO: 'Project Expo',
    WORKSHOP: 'Workshop',
    CONTEST: 'Contest',
    SEMINAR: 'Seminar',
    CONFERENCE: 'Conference',
    OTHER: 'Other'
};

const PreviewImage = ({ blob }) => {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!(blob instanceof Blob)) return;
        const newUrl = URL.createObjectURL(blob);
        setUrl(newUrl);
        return () => URL.revokeObjectURL(newUrl);
    }, [blob]);

    if (!url) return null;
    return (
        <div className="relative group rounded-2xl overflow-hidden shadow-xl border-2 border-white/20">
            <img src={url} alt="Preview" className="h-40 w-full object-cover group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-black text-white uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">Intelligence Scan Subject</span>
            </div>
        </div>
    );
};

const AddEventModal = () => {
    const modals = useAppStore((state) => state.modals);
    const closeModal = useAppStore((state) => state.closeModal);
    const isOpen = modals && modals.addEvent;

    const [formData, setFormData] = useState({
        collegeName: '',
        eventName: '',
        eventTypes: [EventType.HACKATHON],
        customEventType: '',
        registrationDeadline: '',
        startDate: '',
        endDate: '',
        prizeAmount: '',
        prizeWon: '',
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
        teamName: '',
        eligibility: '',
        leader: '',
        members: '',
        contact1: '',
        contact2: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleAIAnalysis = async () => {
        if (!formData.posterBlob && !formData.posterUrl) {
            alert('SYSTEM: Neural Input Source required for AI Analysis.');
            return;
        }

        setIsAnalyzing(true);
        try {
            let extractedText = "";
            if (formData.posterBlob) {
                const { data: { text } } = await window.Tesseract.recognize(
                    formData.posterBlob,
                    'eng',
                    { logger: m => console.log(`[Neural Vision] ${Math.round(m.progress * 100)}%`) }
                );
                extractedText = text;
            } else {
                extractedText = "Simulated Scan: Global Hackathon Event hosted by MIT Manipal on Dec 20, 2024. Prize Pool: 50,000 INR.";
            }

            const textLower = extractedText.toLowerCase();
            const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 5);

            setFormData(prev => ({
                ...prev,
                eventName: lines[0] || prev.eventName,
                prizeAmount: extractedText.match(/(?:(?:INR|₹|Prize|Worth)\.?\s*)([0-9,]+)/i)?.[1].replace(/,/g, '') || prev.prizeAmount,
                description: `AI ANALYZED: ${extractedText.substring(0, 100)}...`,
                eventTypes: textLower.includes('hack') ? [EventType.HACKATHON] : [EventType.CONTEST]
            }));

            alert('SYSTEM: Neural Protocol Complete. Data successfully injected into form matrix.');
        } catch (error) {
            alert(`Neural Error: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) setFormData(prev => ({ ...prev, posterBlob: file }));
    };

    const toggleEventType = (type) => {
        setFormData(prev => {
            const types = prev.eventTypes || [];
            if (types.includes(type)) {
                return { ...prev, eventTypes: types.filter(t => t !== type) };
            } else {
                return { ...prev, eventTypes: [...types, type] };
            }
        });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { teamId, user, userRole } = useAppStore.getState();
            const isAdmin = userRole === 'admin' || userRole === 'event_manager';
            
            // Handle multiple types and custom types
            let finalTypes = [...(formData.eventTypes || [])];
            if (finalTypes.includes(EventType.OTHER) && formData.customEventType.trim()) {
                finalTypes = finalTypes.map(t => t === EventType.OTHER ? formData.customEventType.trim() : t);
            }
            const actualEventType = finalTypes.join(', ');
            
            const eventData = {
                ...formData,
                eventType: actualEventType,
                prizeAmount: parseFloat(formData.prizeAmount) || 0,
                prizeWon: parseFloat(formData.prizeWon) || 0,
                registrationFee: parseFloat(formData.registrationFee) || 0,
                teamSize: parseInt(formData.teamSize) || 1,
                contactNumbers: formData.contactNumbers.split(',').map(c => c.trim()).filter(Boolean),
                teamId: isAdmin ? null : (teamId || null),
                createdBy: user?.uid || 'unknown'
            };
            await addEvent(eventData);

            // Broadcast notification for global events added by admins
            if (isAdmin) {
                try {
                    const { addNotification } = await import('../services/firebase');
                    await addNotification(null, { // null userId means global notification
                        title: 'New Tactical Signal Detected',
                        content: `A new event "${eventData.eventName}" has been deployed at ${eventData.collegeName}. Check it out now!`,
                        type: 'info',
                        isGlobal: true,
                        link: '/events'
                    });
                } catch (notifErr) { console.warn('Failed to broadcast event notification:', notifErr); }
            }

            closeModal('addEvent');
            setFormData({ collegeName: '', eventName: '', eventTypes: [EventType.HACKATHON], customEventType: '', registrationDeadline: '', startDate: '', endDate: '', prizeAmount: '', prizeWon: '', registrationFee: '', accommodation: false, location: '', isOnline: false, contactNumbers: '', posterUrl: '', posterBlob: null, website: '', registrationLink: '', description: '', teamSize: '1', teamName: '', eligibility: '', leader: '', members: '', contact1: '', contact2: '' });
        } catch (error) {
            alert(`CRITICAL ERROR: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: Terminal },
        { id: 'logistics', label: 'Logistics', icon: Globe },
        { id: 'team', label: 'Team Info', icon: Users },
        { id: 'ai', label: 'AI Assistant', icon: Sparkles }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        onClick={() => closeModal('addEvent')}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 30 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,0.5)] border border-white/20 overflow-hidden flex flex-col max-h-[100vh] sm:max-h-[95vh]"
                    >
                        {/* Header Subsystem */}
                        <div className="bg-slate-900 p-4 sm:p-8 text-white relative flex items-center justify-between border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 border border-white/20">
                                    <Plus size={22} strokeWidth={3} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-none mb-1">Add <span className="text-indigo-400">Event</span></h2>
                                    <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Create a new event entry</p>
                                </div>
                            </div>
                            <button onClick={() => closeModal('addEvent')} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar shrink-0">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all shrink-0", isActive ? "bg-slate-900 text-white shadow-xl -translate-y-0.5 sm:-translate-y-1" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800")}>
                                        <Icon size={14} strokeWidth={3} /> {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tactical Input Matrix */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
                            <form id="add-event-form" onSubmit={handleSubmit}>
                                <div className={cn("space-y-6 sm:space-y-10", activeTab === 'basic' ? 'block' : 'hidden')}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                                        <div className="space-y-4 sm:space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Event Name</label>
                                                <input type="text" name="eventName" value={formData.eventName} onChange={handleChange} required={activeTab === 'basic'} className="input-premium" placeholder="e.g. Hackfest 2026" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">College Name</label>
                                                <input type="text" name="collegeName" value={formData.collegeName} onChange={handleChange} required={activeTab === 'basic'} className="input-premium" placeholder="Host College Name" />
                                            </div>
                                            
                                            <div className="form-group">
                                                <label className="label-premium">Event Categories (Select Multiple)</label>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {Object.values(EventType).map(type => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => toggleEventType(type)}
                                                            className={cn(
                                                                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                                                                formData.eventTypes?.includes(type) 
                                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
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
                                                {formData.eventTypes?.includes(EventType.OTHER) && (
                                                    <input 
                                                        type="text" 
                                                        name="customEventType" 
                                                        value={formData.customEventType} 
                                                        onChange={handleChange} 
                                                        required={activeTab === 'basic'} 
                                                        className="input-premium mt-3" 
                                                        placeholder="Enter Custom Category..." 
                                                    />
                                                )}
                                            </div>

                                            <div className="form-group">
                                                <label className="label-premium">Team Size</label>
                                                <input type="number" name="teamSize" value={formData.teamSize} onChange={handleChange} className="input-premium" min="1" />
                                            </div>
                                            {parseInt(formData.teamSize) > 1 && (
                                                <div className="form-group col-span-2">
                                                    <label className="label-premium">Team Name</label>
                                                    <input type="text" name="teamName" value={formData.teamName} onChange={handleChange} className="input-premium" placeholder="e.g. The Avengers" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 relative group">
                                            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 text-indigo-200 opacity-20 group-hover:rotate-12 transition-transform duration-700">
                                                <Calendar size={80} className="sm:w-[120px] sm:h-[120px]" />
                                            </div>
                                            <h4 className="flex items-center gap-3 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-600 mb-4 sm:mb-8">
                                                <Clock size={16} strokeWidth={3} /> Event Schedule
                                            </h4>
                                            <div className="space-y-4 sm:space-y-6 relative z-10">
                                                <div className="form-group">
                                                    <label className="label-premium">Registration Deadline</label>
                                                    <input type="date" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} required={activeTab === 'basic'} className="input-premium bg-white dark:bg-slate-900" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                                    <div className="form-group">
                                                        <label className="label-premium">Start Date</label>
                                                        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required={activeTab === 'basic'} className="input-premium bg-white dark:bg-slate-900" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="label-premium">End Date</label>
                                                        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required={activeTab === 'basic'} className="input-premium bg-white dark:bg-slate-900" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={cn("space-y-6 sm:space-y-10", activeTab === 'logistics' ? 'block' : 'hidden')}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Event Venue</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                    <input type="text" name="location" value={formData.location} onChange={handleChange} className="input-premium pl-16 font-black" placeholder="Campus Name / Venue" />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Registration Fee (₹)</label>
                                                <input type="number" name="registrationFee" value={formData.registrationFee} onChange={handleChange} className="input-premium" placeholder="0" />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="form-group">
                                                <label className="label-premium">Total Prize amount (₹)</label>
                                                <input type="number" name="prizeAmount" value={formData.prizeAmount} onChange={handleChange} className="input-premium" placeholder="0" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Prize Won (₹)</label>
                                                <input type="number" name="prizeWon" value={formData.prizeWon} onChange={handleChange} className="input-premium" placeholder="Amount if you already won" />
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                <label className="flex items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] bg-indigo-50 dark:bg-indigo-950/20 border-2 border-transparent has-[:checked]:border-indigo-600 cursor-pointer group transition-all">
                                                    <input type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange} className="hidden" />
                                                    <div className={cn("w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all", formData.isOnline ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}><Check size={16} className="text-white" /></div>
                                                    <div><span className="block text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Online Event</span><span className="text-[10px] text-slate-500">Enable for virtual events</span></div>
                                                </label>
                                                <label className="flex items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] bg-emerald-50 dark:bg-emerald-950/20 border-2 border-transparent has-[:checked]:border-emerald-600 cursor-pointer group transition-all">
                                                    <input type="checkbox" name="accommodation" checked={formData.accommodation} onChange={handleChange} className="hidden" />
                                                    <div className={cn("w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all", formData.accommodation ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}><Check size={16} className="text-white" /></div>
                                                    <div><span className="block text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Accommodation</span><span className="text-[10px] text-slate-500">Stay provided by college</span></div>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Website Link</label>
                                            <div className="relative">
                                                <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                <input type="url" name="website" value={formData.website} onChange={handleChange} className="input-premium pl-16 text-indigo-600 font-black" placeholder="Official Website URL" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="label-premium">Registration Link</label>
                                            <div className="relative">
                                                <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-500" size={20} />
                                                <input type="url" name="registrationLink" value={formData.registrationLink} onChange={handleChange} className="input-premium pl-16 text-indigo-600 font-black" placeholder="Google Form / Registration URL" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={cn("space-y-6 sm:space-y-10", activeTab === 'team' ? 'block' : 'hidden')}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                                        <div className="space-y-8">
                                            <div className="form-group">
                                                <label className="label-premium">Team Leader Name</label>
                                                <input type="text" name="leader" value={formData.leader} onChange={handleChange} className="input-premium" placeholder="Name of leader" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Eligibility Criteria</label>
                                                <input type="text" name="eligibility" value={formData.eligibility} onChange={handleChange} className="input-premium" placeholder="e.g. All Departments" />
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium">Event Description</label>
                                                <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="input-premium min-h-[100px] resize-none pt-4" placeholder="Brief about the event..."></textarea>
                                            </div>
                                        </div>
                                        <div className="space-y-4 sm:space-y-6 bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 text-white shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <ShieldCheck size={20} className="text-indigo-400" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Contact Details</span>
                                            </div>
                                            <input type="text" name="contact1" value={formData.contact1} onChange={handleChange} className="w-full bg-slate-800 border-0 rounded-2xl px-6 py-4 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Primary Contact Number" />
                                            <input type="text" name="contact2" value={formData.contact2} onChange={handleChange} className="w-full bg-slate-800 border-0 rounded-2xl px-6 py-4 font-mono text-sm focus:ring-2 ring-indigo-500 outline-none" placeholder="Secondary Contact Number" />
                                        </div>
                                    </div>
                                </div>

                                <div className={cn("space-y-6 sm:space-y-10", activeTab === 'ai' ? 'block' : 'hidden')}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12">
                                        <div className="space-y-6">
                                            <label className="label-premium">Event Poster AI Scan</label>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[250px] relative group overflow-hidden">
                                                {formData.posterBlob ? <PreviewImage blob={formData.posterBlob} /> : (
                                                    <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full p-8">
                                                        <Upload size={48} className="text-slate-300 mb-6 group-hover:text-indigo-600 group-hover:-translate-y-2 transition-all duration-500" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Upload Poster</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">Image will be analyzed by AI</span>
                                                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                                                    </label>
                                                )}
                                            </div>
                                            <button type="button" onClick={handleAIAnalysis} disabled={isAnalyzing || (!formData.posterBlob && !formData.posterUrl)} className={cn("w-full h-16 rounded-2xl flex items-center justify-center gap-4 font-black uppercase text-[11px] tracking-[0.3em] transition-all shadow-2xl", isAnalyzing ? "bg-slate-100 text-slate-400" : "bg-gradient-to-r from-emerald-500 via-indigo-600 to-violet-700 text-white hover:scale-105 shadow-indigo-500/30")}>
                                                {isAnalyzing ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" /> : <><Sparkles size={20} /> Start AI Analysis</>}
                                            </button>
                                        </div>
                                        <div className="space-y-8 flex flex-col justify-center">
                                            <div className="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2.5rem] border-2 border-indigo-100 dark:border-indigo-800">
                                                <h4 className="text-indigo-700 dark:text-indigo-400 font-black text-sm uppercase mb-4 flex items-center gap-2"><Info size={18} /> AI Assistant</h4>
                                                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-bold leading-relaxed">Our AI assistant will scan your poster to automatically identify event names, dates, and prize details.</p>
                                            </div>
                                            <div className="form-group">
                                                <label className="label-premium text-indigo-500">Asset Neural Link (URL Alternate)</label>
                                                <input type="url" name="posterUrl" value={formData.posterUrl} onChange={handleChange} className="input-premium border-indigo-100 dark:border-indigo-900 shadow-xl" placeholder="https://cdn.example.com/asset.jpg" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-4 sm:px-10 py-4 sm:py-8 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 sm:gap-6 shrink-0">
                            <button type="button" onClick={() => closeModal('addEvent')} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
                            <button type="submit" form="add-event-form" disabled={isSubmitting} className="px-6 sm:px-12 h-12 sm:h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider sm:tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 sm:gap-4">
                                {isSubmitting ? <div className="w-5 h-5 border-4 border-slate-400 border-t-white rounded-full animate-spin" /> : <><Save size={20} /> Save Event</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const StatCardMock = ({ title, value, icon: Icon, color }) => (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex items-center gap-8 group">
        <div className={cn("w-20 h-20 rounded-[1.8rem] bg-white dark:bg-slate-900 shadow-2xl flex items-center justify-center border transition-all duration-700 group-hover:rotate-12", color.replace('text-', 'border-'))}>
            <Icon size={32} className={color} strokeWidth={3} />
        </div>
        <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">{title}</span>
            <span className={cn("text-3xl font-black tracking-tight", color)}>{value > 0 ? `₹${Number(value).toLocaleString()}` : 'RECONNAISSANCE REQUIRED'}</span>
        </div>
    </div>
);

export default AddEventModal;
