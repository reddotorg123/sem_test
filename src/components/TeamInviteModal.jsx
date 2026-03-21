import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Link as LinkIcon, CheckCircle2, Copy, Plus, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const TeamInviteModal = () => {
    const isOpen = useAppStore((state) => state.modals.teamInvite);
    const closeModal = useAppStore((state) => state.closeModal);
    const userRole = useAppStore((state) => state.userRole);

    const [inviteCode, setInviteCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [currentMembers, setCurrentMembers] = useState(0);
    const [memberEmail, setMemberEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addStatus, setAddStatus] = useState({ type: '', msg: '' });

    // Initial load to check current member count
    React.useEffect(() => {
        if (isOpen && auth?.currentUser) {
            import('../services/firebase').then(({ db }) => {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                getDoc(userRef).then(docSnap => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setCurrentMembers((data.teamMembers || []).length);
                        if (data.inviteCode) {
                            setInviteCode(data.inviteCode);
                        }
                    }
                });
            });
        }
    }, [isOpen]);


    const generateLink = async () => {
        setIsGenerating(true);
        try {
            const newCode = Array.from({ length: 8 }, () => Math.random().toString(36).charAt(2)).join('').toUpperCase();

            if (auth?.currentUser) {
                const { db } = await import('../services/firebase');
                const userRef = doc(db, 'users', auth.currentUser.uid);
                await updateDoc(userRef, { inviteCode: newCode });
            }

            setInviteCode(newCode);
        } catch (error) {
            console.error('Failed to generate code', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!memberEmail) return;
        setIsAdding(true);
        setAddStatus({ type: '', msg: '' });

        try {
            if (!db) throw new Error("Database not initialized");
            
            // 1. Find user by email
            const q = query(collection(db, "users"), where("email", "==", memberEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setAddStatus({ type: 'error', msg: 'User not found. They must register first.' });
                return;
            }

            const targetUser = querySnapshot.docs[0];
            const targetUserId = targetUser.id;

            // 2. Check if already in a team
            if (targetUser.data().teamId) {
                setAddStatus({ type: 'error', msg: 'User is already in a team.' });
                return;
            }

            // 3. Update user's teamId and role
            await updateDoc(doc(db, "users", targetUserId), {
                teamId: auth.currentUser.uid,
                role: 'member'
            });

            setAddStatus({ type: 'success', msg: 'Member added successfully!' });
            setMemberEmail('');
            // Refresh member count
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                setCurrentMembers((docSnap.data().teamMembers || []).length + 1); // Simple increment for UI feedback
            }
        } catch (error) {
            console.error(error);
            setAddStatus({ type: 'error', msg: error.message || 'Failed to add member.' });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => closeModal('teamInvite')}
                    />

                    {userRole === 'public' ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl"
                        >
                            <Users size={32} className="mx-auto mb-4 text-slate-400" />
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Team Edition Required</h3>
                            <p className="text-sm font-bold text-slate-500 mb-6">Upgrade to add up to 10 team members.</p>
                            <button onClick={() => closeModal('teamInvite')} className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">Close</button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
                        >
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                                <Users size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Team Roster</h2>
                            <p className="text-xs font-bold text-indigo-500 mt-2 uppercase tracking-widest">{currentMembers} / 10 Members Added</p>
                        </div>
                        <button onClick={() => closeModal('teamInvite')} className="p-3 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 rounded-full text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Direct Add Form */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Direct Add</h3>
                            <form onSubmit={handleAddMember} className="space-y-3">
                                <div className="relative group">
                                    <input 
                                        type="email" 
                                        placeholder="Enter member email" 
                                        value={memberEmail}
                                        onChange={(e) => setMemberEmail(e.target.value)}
                                        className="w-full px-5 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:border-indigo-600 transition-all"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={isAdding || !memberEmail}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    </button>
                                </div>
                                {addStatus.msg && (
                                    <p className={`text-[10px] font-bold px-2 ${addStatus.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {addStatus.msg}
                                    </p>
                                )}
                            </form>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Invite Link</h3>
                            <p className="text-[10px] font-semibold text-slate-500 mb-4 px-1">
                                Share this link with your peers for automatic onboarding.
                            </p>

                            {inviteCode ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                                        <LinkIcon size={16} className="text-slate-400 shrink-0 ml-2" />
                                        <input type="text" readOnly value={`${window.location.origin}/invite/${auth?.currentUser?.uid}`} className="bg-transparent border-none outline-none font-black text-[10px] w-full text-slate-600 dark:text-slate-300 truncate" />
                                        <button onClick={() => {
                                            const link = `${window.location.origin}/invite/${auth?.currentUser?.uid}`;
                                            navigator.clipboard.writeText(link);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }} className="shrink-0 p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                                            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <button onClick={generateLink} disabled={isGenerating} className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors">
                                        Refresh Invite Status
                                    </button>
                                </div>
                            ) : (
                                <button onClick={generateLink} disabled={isGenerating} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 transition-all">
                                    {isGenerating ? 'Generating...' : 'Create Invite Link'}
                                </button>
                            )}
                        </div>
                    </div>
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
};

export default TeamInviteModal;
