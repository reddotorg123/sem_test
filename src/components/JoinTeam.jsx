import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppStore } from '../store';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { ShieldCheck, Users, Loader2, ArrowRight } from 'lucide-react';

const JoinTeam = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();

    const user = useAppStore((state) => state.user);
    const userRole = useAppStore((state) => state.userRole);
    const setUserRole = useAppStore((state) => state.setUserRole);
    const setTeamId = useAppStore((state) => state.setTeamId);

    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const [resolvedTeamId, setResolvedTeamId] = useState(null);
    const [teamName, setTeamName] = useState('Team Workspace');

    useEffect(() => {
        const resolveAndFetch = async () => {
            if (!db || !teamId) return;
            setStatus('loading');
            try {
                // 1. Try to fetch as direct UID
                let leaderDoc = await getDoc(doc(db, 'users', teamId));
                
                // 2. If not a UID, try searching as an Invite Code
                if (!leaderDoc.exists()) {
                    const { query, collection, where, getDocs } = await import('firebase/firestore');
                    const q = query(collection(db, 'users'), where('inviteCode', '==', teamId.toUpperCase()));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        leaderDoc = querySnapshot.docs[0];
                    }
                }

                if (leaderDoc.exists()) {
                    setTeamName(`${leaderDoc.data().displayName || 'Leader'}'s Team`);
                    setResolvedTeamId(leaderDoc.id);
                    setStatus('idle');
                } else {
                    setErrorMsg("Invalid Team ID or Invite Code. Please check and try again.");
                    setStatus('error');
                }
            } catch (err) {
                console.error("Resolution failed", err);
                setErrorMsg("Failed to connect to the tactical network.");
                setStatus('error');
            }
        };
        resolveAndFetch();
    }, [teamId]);

    const handleJoinTeam = async () => {
        if (!user) {
            setErrorMsg("Please log in or register first before joining a team.");
            setStatus('error');
            return;
        }

        // Public users ARE allowed to join teams (they become 'member')
        // if (userRole === 'public') { ... removed this barrier ... }

        // Removed strictly blocking subscribers. They can join others, but their role becomes 'member'.
        /* if (userRole === 'subscriber' || userRole === 'team_leader' || userRole === 'admin') {
            setErrorMsg("You are already a Team Leader or Admin. You cannot join another team. You must first downgrade your role to 'public' to join a different team.");
            setStatus('error');
            return;
        } */

        if (!resolvedTeamId) {
            setErrorMsg("Could not verify team. Please try again.");
            setStatus('error');
            return;
        }

        const { teamId: currentTeamId } = useAppStore.getState();
        if (currentTeamId && currentTeamId !== user.uid && currentTeamId !== resolvedTeamId) {
            setErrorMsg("You are already in another team. Please leave your current team before joining this one.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        try {
            if (db && auth?.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                await updateDoc(userRef, {
                    role: 'member',
                    teamId: resolvedTeamId
                });

                // Update local role and team
                setUserRole('member');
                setTeamId(resolvedTeamId);
                setStatus('success');

                setTimeout(() => {
                    navigate('/');
                }, 2000);
            } else {
                throw new Error("Database not initialized");
            }
        } catch (error) {
            console.error(error);
            setErrorMsg(error.message || "Failed to join team.");
            setStatus('error');
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col justify-center items-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 text-center border border-slate-100 dark:border-slate-800"
            >
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
                    <Users size={40} />
                </div>

                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Join {teamName}</h1>
                <p className="text-sm font-bold text-slate-500 mb-8 max-w-xs mx-auto">
                    You've been invited to collaborate in a Team Edition workspace.
                </p>

                {status === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-6 rounded-2xl flex flex-col items-center"
                    >
                        <ShieldCheck size={32} className="mb-3" />
                        <p className="font-black uppercase tracking-widest text-xs">Successfully Joined!</p>
                        <p className="text-[10px] opacity-70 mt-1">Redirecting to dashboard...</p>
                    </motion.div>
                ) : status === 'error' ? (
                    <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 p-6 rounded-2xl mb-6 text-sm font-bold border border-rose-100 dark:border-rose-900/50">
                        {errorMsg}
                    </div>
                ) : null}

                {status !== 'success' && (
                    <div className="space-y-4">
                        <button
                            onClick={handleJoinTeam}
                            disabled={status === 'loading'}
                            className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
                        >
                            {status === 'loading' ? (
                                <><Loader2 size={18} className="animate-spin" /> Verifying Invitation...</>
                            ) : (
                                <>Accept Invitation <ArrowRight size={16} /></>
                            )}
                        </button>

                        {!user && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Or <span className="text-indigo-600 cursor-pointer hover:underline" onClick={() => navigate('/')}>Login First</span>
                            </p>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default JoinTeam;
