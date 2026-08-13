"use client";
import { onAuthStateChanged, type User, updateProfile as updateAuthProfile } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { profile } from "@/services/auth";
import type { UserProfile } from "@/types";
type State = { user: User | null; profile: UserProfile | null; loading: boolean };
const AuthContext = createContext<State>({ user:null, profile:null, loading:true });
export function Providers({children}:{children:React.ReactNode}) { const [state,setState]=useState<State>({user:null,profile:null,loading:true}); useEffect(()=>{ const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""; if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(()=>undefined); return onAuthStateChanged(auth, async user=>{ try { const userProfile=user ? await profile(user.uid) : null; if(user&&userProfile?.name&&!user.displayName) await updateAuthProfile(user,{displayName:userProfile.name}); setState({user,profile:userProfile,loading:false}); } catch { setState({user,profile:null,loading:false}); } }); },[]); return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>; }
export const useAuth = () => useContext(AuthContext);
