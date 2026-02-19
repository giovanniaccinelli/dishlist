"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import BottomNav from "../../components/BottomNav";
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Dishlists() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const snapshot = await getDocs(collection(db, "users"));
    const usersList = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    // Add dish counts per user (simple query per user)
    const withCounts = await Promise.all(
      usersList.map(async (u) => {
        const dishSnap = await getDocs(
          query(collection(db, "dishes"), where("owner", "==", u.id))
        );
        return { ...u, dishCount: dishSnap.size || 0 };
      })
    );

    setUsers(withCounts);
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => u.displayName?.toLowerCase().includes(term));
  }, [users, search]);

  const handleFollow = async (userId, alreadyFollowing) => {
    if (!user) return alert("Log in first");
    const targetRef = doc(db, "users", userId);
    const currentRef = doc(db, "users", user.uid);
    await updateDoc(targetRef, {
      followers: alreadyFollowing ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    await updateDoc(currentRef, {
      following: alreadyFollowing ? arrayRemove(userId) : arrayUnion(userId),
    });
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-4">Dishlists</h1>
      <input
        type="text"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-6 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/30"
      />

      {loadingUsers ? (
        <div className="text-black/60">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No users found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredUsers.map((u) => {
            const isMe = user?.uid === u.id;
            const alreadyFollowing = u.followers?.includes(user?.uid);
            return (
              <div key={u.id} className="bg-white rounded-2xl p-4 shadow-md flex items-center justify-between">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center text-xl font-bold">
                    {u.displayName?.[0] || "U"}
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{u.displayName || "User"}</div>
                    <div className="text-xs text-black/60">
                      {u.dishCount || 0} dishes · {u.followers?.length || 0} followers
                    </div>
                  </div>
                </Link>
                {!isMe && (
                  <button
                    onClick={() => handleFollow(u.id, alreadyFollowing)}
                    className="bg-black text-white px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    {alreadyFollowing ? "Unfollow" : "Follow"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
