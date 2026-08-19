"use client";

import { onAuthStateChanged, type User, updateProfile as updateAuthProfile } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getSystemConfig, profile as loadProfile } from "@/services/auth";
import type { UserProfile } from "@/types";

type State = {
  user: User | null;
  profile: UserProfile | null;
  admin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<State>({
  user: null,
  profile: null,
  admin: false,
  loading: true,
  refreshProfile: async () => undefined,
});

async function registerPwaUpdate() {
  if (!("serviceWorker" in navigator)) return;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "local";
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  const registration = await navigator.serviceWorker.register(`${basePath}/sw.js?v=${buildVersion}`, { updateViaCache: "none" });
  await registration.update();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setProfile(null);
      setAdmin(false);
      return;
    }
    const [userProfile, config] = await Promise.all([loadProfile(current.uid), getSystemConfig()]);
    if (userProfile?.name && current.displayName !== userProfile.name) {
      await updateAuthProfile(current, { displayName: userProfile.name });
    }
    setProfile(userProfile);
    setAdmin(config?.adminUid === current.uid);
  }, []);

  useEffect(() => {
    void registerPwaUpdate().catch(() => undefined);
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setAdmin(false);
        setLoading(false);
        return;
      }
      try {
        await refreshProfile();
      } catch {
        setProfile(null);
        setAdmin(false);
      } finally {
        setLoading(false);
      }
    });
  }, [refreshProfile]);

  return <AuthContext.Provider value={{ user, profile, admin, loading, refreshProfile }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
