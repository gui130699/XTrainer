"use client";
import Link from "next/link";
import { BarChart3, Dumbbell, History, Home, UserRound, Wifi, WifiOff } from "lucide-react";
import { useEffect,useState } from "react";
import { useAuth } from "@/components/providers";
const links=[['/','Início',Home],['/treino','Treino',Dumbbell],['/evolucao','Evolução',BarChart3],['/historico','Histórico',History],['/perfil','Perfil',UserRound]] as const;
export function AppShell({children}:{children:React.ReactNode}){const[online,setOnline]=useState(true);const{profile}=useAuth();useEffect(()=>{setOnline(navigator.onLine);const a=()=>setOnline(navigator.onLine);addEventListener('online',a);addEventListener('offline',a);return()=>{removeEventListener('online',a);removeEventListener('offline',a)}},[]);const role=profile?.role==='admin'?'Administrador':'Usuário';return <div className="shell"><aside><Link className="brand" href="/">X<span>Trainer</span></Link><nav>{links.map(([href,label,Icon])=><Link key={href} href={href}><Icon size={20}/>{label}</Link>)}</nav><p className="connection" title={online?'Online':'Offline'}><UserRound size={15}/>{role}</p></aside><main>{children}</main><nav className="bottom-nav">{links.map(([href,label,Icon])=><Link key={href} href={href}><Icon size={20}/><small>{label}</small></Link>)}</nav></div>}
