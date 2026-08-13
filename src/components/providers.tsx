"use client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { profile } from "@/services/auth";
import type { UserProfile } from "@/types";
type State = { user: User | null; profile: UserProfile | null; loading: boolean };
const AuthContext = createContext<State>({ user:null, profile:null, loading:true });
export function Providers({children}:{children:React.ReactNode}) { const [state,setState]=useState<State>({user:null,profile:null,loading:true}); useEffect(()=>{ const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""; if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(()=>undefined); return onAuthStateChanged(auth, async user=>{ setState({user,profile:user ? await profile(user.uid) : null,loading:false}); }); },[]); return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>; }
export const useAuth = () => useContext(AuthContext);
