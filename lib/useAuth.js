"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load profile from profiles table
  const loadProfile = useCallback(async (userId) => {
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (err) {
      // Profile doesn't exist yet — create one with default role
      if (err.code === "PGRST116") {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || "";
        const name = userData?.user?.user_metadata?.full_name || email.split("@")[0] || "";
        const newProfile = {
          id: userId,
          email,
          full_name: name,
          role: "teacher", // default — Head Office promotes
          centre_id: null,
        };
        const { data: created, error: createErr } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();
        if (createErr) {
          console.error("Create profile error:", createErr);
          // Still set a local profile so user can see something
          setProfile(newProfile);
        } else {
          setProfile(created);
        }
        return;
      }
      console.error("Load profile error:", err);
      return;
    }
    setProfile(data);
  }, []);

  // Check session on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      }
      setLoading(false);
    };
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Login
  const login = async (email, password) => {
    setError(null);

    // Check domain
    if (!email.endsWith("@uklc.org")) {
      setError("Only @uklc.org email addresses are allowed.");
      return false;
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  };

  // Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // Change password
  const changePassword = async (newPassword) => {
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) return err.message;
    return null;
  };

  return {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    changePassword,
    isAuthenticated: !!user,
    isHeadOffice: profile?.role === "head_office",
    isManager: ["head_office", "centre_manager", "course_director"].includes(profile?.role),
    canWrite: ["head_office", "centre_manager", "course_director", "exc_activity_mgr", "safeguarding_coord"].includes(profile?.role),
    userCentreId: profile?.centre_id,
    userName: profile?.full_name || user?.email?.split("@")[0] || "",
    userRole: profile?.role || "teacher",
  };
}
