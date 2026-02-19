"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../lib/firebase";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import { useAuth } from "../lib/auth";

export default function Explore() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  // Fetch all users
  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const usersList = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));
    setUsers(usersList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Follow/Unfollow handler
  const handleFollow = async (userId) => {
    if (!user) return alert("Log in first");
    const userRef = doc(db, "users", userId);
    const currentUserRef = doc(db, "users", user.uid);
    const updatedUser = users.find(u => u.id === userId);
    const alreadyFollowing = updatedUser.followers?.includes(user.uid);
    const newFollowers = alreadyFollowing
      ? updatedUser.followers.filter(f => f !== user.uid)
      : [...(updatedUser.followers || []), user.uid];
    await updateDoc(userRef, { followers: newFollowers });
    await updateDoc(currentUserRef, {
      following: alreadyFollowing ? arrayRemove(userId) : arrayUnion(userId),
    });
    fetchUsers();
  };

  const filteredUsers = users.filter(u =>
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Explore Profiles</h1>
      <input
        type="text"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-6 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      />

      {filteredUsers.length === 0 ? (
        <p className="text-gray-400">No users found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredUsers.map(u => (
            <div key={u.id} className="bg-[#1A1A1A] p-4 rounded-xl shadow">
              <Link href={`/profile/${u.id}`}>
                <div className="cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-500 to-pink-500 flex items-center justify-center text-2xl font-bold mb-3">
                    {u.displayName?.[0] || "U"}
                  </div>
                  <h2 className="text-lg font-semibold">{u.displayName}</h2>
                  <p className="text-gray-400 text-sm">{u.email}</p>
                </div>
              </Link>
              {user && user.uid !== u.id && (
                <button
                  onClick={() => handleFollow(u.id)}
                  className="mt-3 w-full bg-red-500 hover:bg-red-600 py-1 rounded-full"
                >
                  {u.followers?.includes(user.uid) ? "Unfollow" : "Follow"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
