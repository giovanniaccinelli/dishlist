"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import BottomNav from "../../components/BottomNav";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const INITIAL_USERS_LIMIT = 10;

export default function Dishlists() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [allUsersPool, setAllUsersPool] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);

  const attachDishCounts = async (usersList) => {
    return Promise.all(
      usersList.map(async (u) => {
        const dishSnap = await getDocs(
          query(collection(db, "dishes"), where("owner", "==", u.id))
        );
        return { ...u, dishCount: dishSnap.size || 0 };
      })
    );
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const snapshot = await getDocs(query(collection(db, "users"), limit(INITIAL_USERS_LIMIT)));
    const usersList = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    const withCounts = await attachDishCounts(usersList);
    setUsers(withCounts);
    setHasMoreUsers(usersList.length === INITIAL_USERS_LIMIT);
    setLoadingUsers(false);
  };

  const fetchAllUsersForSearch = async () => {
    if (allUsersPool) return;
    setSearchLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const usersList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      const withCounts = await attachDishCounts(usersList);
      setAllUsersPool(withCounts);
      if (!search.trim()) {
        setHasMoreUsers(users.length < withCounts.length);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMoreUsers = async () => {
    if (loadingMoreUsers || loadingUsers || search.trim()) return;
    setLoadingMoreUsers(true);
    try {
      let pool = allUsersPool;
      if (!pool) {
        const snapshot = await getDocs(collection(db, "users"));
        const usersList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        pool = await attachDishCounts(usersList);
        setAllUsersPool(pool);
      }

      setUsers((prev) => {
        const ids = new Set(prev.map((u) => u.id));
        const nextChunk = pool
          .filter((u) => !ids.has(u.id))
          .slice(0, INITIAL_USERS_LIMIT);
        const merged = [...prev, ...nextChunk];
        setHasMoreUsers(merged.length < pool.length);
        return merged;
      });
    } finally {
      setLoadingMoreUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!search.trim()) return;
    fetchAllUsersForSearch();
  }, [search]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    const source = allUsersPool || [];
    return source.filter((u) => u.displayName?.toLowerCase().includes(term));
  }, [users, allUsersPool, search]);

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
    if (allUsersPool) setAllUsersPool(null);
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
      ) : search.trim() && searchLoading ? (
        <div className="text-black/60">Searching all users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No users found.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-4">
            {filteredUsers.map((u) => {
              const isMe = user?.uid === u.id;
              const alreadyFollowing = u.followers?.includes(user?.uid);
              return (
                <div key={u.id} className="bg-white rounded-2xl p-4 shadow-md flex items-center justify-between">
                  <Link href={`/profile/${u.id}`} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center text-xl font-bold">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        u.displayName?.[0] || "U"
                      )}
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

          {!search.trim() && hasMoreUsers && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMoreUsers}
                disabled={loadingMoreUsers}
                className="bg-black text-white px-6 py-3 rounded-full font-semibold disabled:opacity-60"
              >
                {loadingMoreUsers ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
