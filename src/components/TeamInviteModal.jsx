import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Link as LinkIcon, CheckCircle2, Copy, Plus, Loader2, Trash2, ShieldCheck, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, getTeamMembers, updateMemberPosition } from '../services/firebase';

const TeamInviteModal = () => {
    const isOpen = useAppStore((state) => state.modals.teamInvite);
    const closeModal = useAppStore((state) => state.closeModal);
    const userRole = useAppStore((state) => state.userRole);
    const navigate = useNavigate();

    const [inviteCode, setInviteCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [members, setMembers] = useState([]);
    const [memberEmail, setMemberEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [addStatus, setAddStatus] = useState({ type: '', msg: '' });

    // Load team members
    const fetchMembers = async () => {
        if (!auth?.currentUser) return;
        setIsLoadingMembers(true);
        try {
            const teamId = auth.currentUser.uid;
            const fetched = await getTeamMembers(teamId);
            setMembers(fetched);
        } catch (error) {
            console.error('Failed to fetch members', error);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    useEffect(() => {
        if (isOpen && auth?.currentUser) {
            fetchMembers();
            // Get invite code
            const userRef = doc(db, 'users', auth.currentUser.uid);
            getDoc(userRef).then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.inviteCode) setInviteCode(data.inviteCode);
                }
            });
        }
    }, [isOpen]);

    const generateLink = async () => {
        setIsGenerating(true);
        try {
            const newCode = Array.from({ length: 8 }, () => Math.random().toString(36).charAt(2)).join('').toUpperCase();
            if (auth?.currentUser) {
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

            // 2. Check if already in a team (teamId exists and is DIFFERENT from their own uid)
            const targetData = targetUser.data();
            if (targetData.teamId && targetData.teamId !== targetUserId) {
                setAddStatus({ type: 'error', msg: 'User is already in another team. They must leave it first.' });
                return;
            }

            // 3. Update user's teamId and role
            await updateDoc(doc(db, "users", targetUserId), {
                teamId: auth.currentUser.uid,
                role: 'member'
            });

            setAddStatus({ type: 'success', msg: 'Member added!' });
            setMemberEmail('');
            fetchMembers();
        } catch (error) {
            setAddStatus({ type: 'error', msg: error.message || 'Failed to add member.' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (uid) => {
        if (!window.confirm("Remove this unit from your Tactical Unit?")) return;
        try {
            await updateDoc(doc(db, "users", uid), {
                teamId: uid,
                role: 'public'
            });
            fetchMembers();
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdatePosition = async (uid, pos) => {
        try {
            await updateMemberPosition(uid, pos);
            setMembers(members.map(m => m.id === uid ? { ...m, position: pos } : m));
        } catch (error) {
            console.error(error);
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
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 text-center shadow-2xl border border-slate-100 dark:border-slate-800"
                        >
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
                                <Users size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Team Edition Required</h3>
                            <p className="text-sm font-bold text-slate-500 mb-8 px-4">You need a subscription to START your own team and invite members.</p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={() => {
                                        closeModal('teamInvite');
                                        const id = window.prompt("Enter your Team Leader's UID to join:");
                                        if (id) navigate(`/invite/${id}`);
                                    }}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                                >
                                    Join Existing Team
                                </button>
                                <button 
                                    onClick={() => { closeModal('teamInvite'); useAppStore.getState().openModal('payment'); }} 
                                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Upgrade Channel
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Tactical <span className="text-indigo-600">Unit</span></h2>
                                    <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest leading-none">{members.length} / 10 OPERATIVES ACTIVE</p>
                                </div>
                                <button onClick={() => closeModal('teamInvite')} className="p-3 bg-slate-50 border-2 border-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-8">
                                {/* Direct Add Form */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <Plus size={14} /> Personnel Induction
                                    </h3>
                                    <form onSubmit={handleAddMember} className="flex gap-2">
                                        <input 
                                            type="email" 
                                            placeholder="Enter user email address..." 
                                            value={memberEmail}
                                            onChange={(e) => setMemberEmail(e.target.value)}
                                            className="flex-1 px-5 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-bold outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300"
                                        />
                                        <button 
                                            type="submit" 
                                            disabled={isAdding || !memberEmail}
                                            className="px-6 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                                        >
                                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : 'Induct Unit'}
                                        </button>
                                    </form>
                                    {addStatus.msg && (
                                        <p className={`text-[10px] font-bold mt-2 px-2 ${addStatus.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {addStatus.msg}
                                        </p>
                                    )}
                                </div>

                                {/* Active Unit Roster */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                        <ShieldCheck size={14} /> Active Unit Roster
                                    </h3>
                                    {isLoadingMembers ? (
                                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                                    ) : members.length === 0 ? (
                                        <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-300">No active operatives.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {members.map((member) => (
                                                <div key={member.id} className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-800 hover:border-indigo-600 group transition-all">
                                                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl overflow-hidden flex items-center justify-center text-white font-black text-xl shadow-lg relative">
                                                        {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : (member.displayName || 'U').substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 text-center sm:text-left">
                                                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{member.displayName || 'System Unit'}</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{member.email}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                                            <select 
                                                                value={member.position || 'Explorer'} 
                                                                onChange={(e) => handleUpdatePosition(member.id, e.target.value)}
                                                                className="pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:border-indigo-600 appearance-none min-w-[140px]"
                                                            >
                                                                <option value="Explorer">Operative</option>
                                                                <option value="Leader">Team Leader</option>
                                                                <option value="Designer">UI Designer</option>
                                                                <option value="Developer">Developer</option>
                                                                <option value="Strategist">Strategist</option>
                                                                <option value="Manager">Manager</option>
                                                            </select>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            className="w-10 h-10 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl flex items-center justify-center border border-rose-100 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Invite Connection Link */}
                                <div className="bg-indigo-600 rounded-[2rem] p-8 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform"><LinkIcon size={120} /></div>
                                    <h3 className="text-xl font-black mb-1 relative z-10 uppercase tracking-tighter">Unit Frequency</h3>
                                    <p className="text-[10px] font-bold text-indigo-200 mb-6 uppercase tracking-[0.2em] relative z-10">Invite Link for Automatic Onboarding</p>
                                    
                                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 relative z-10">
                                        <code className="flex-1 text-[10px] font-black truncate">{window.location.origin}/invite/{auth?.currentUser?.uid}</code>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/invite/${auth?.currentUser?.uid}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                                        >
                                            {copied ? 'Captured' : 'Capture Link'}
                                        </button>
                                    </div>
                                    {!inviteCode && (
                                        <button onClick={generateLink} disabled={isGenerating} className="mt-4 w-full text-[9px] font-black uppercase tracking-widest text-indigo-200 hover:text-white transition-all underline underline-offset-4">Synchronize Network Code</button>
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
