"use client";
import { useAuth } from "@/components/providers";
import { Loading } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export function Guard({children,admin=false}:{children:React.ReactNode;admin?:boolean}){const{user,admin:isAdmin,loading}=useAuth();const router=useRouter();useEffect(()=>{if(!loading&&(!user||(admin&&!isAdmin))) router.replace(admin?'/perfil':'/login')},[loading,user,isAdmin,admin,router]);if(loading||!user||(admin&&!isAdmin))return <Loading/>;return <>{children}</>}
