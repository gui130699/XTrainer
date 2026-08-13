"use client";
import { useAuth } from "@/components/providers";
import { Loading } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export function Guard({children,admin=false}:{children:React.ReactNode;admin?:boolean}){const{user,profile,loading}=useAuth();const router=useRouter();useEffect(()=>{if(!loading&&(!user||(admin&&profile?.role!=="admin"))) router.replace(admin?'/perfil':'/login')},[loading,user,profile,admin,router]);if(loading||!user||(admin&&profile?.role!=="admin"))return <Loading/>;return <>{children}</>}
