"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import BottomNav from "../../components/BottomNav";
import StoryViewerModal from "../../components/StoryViewerModal";
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
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import { getActiveStoriesForUser, markStoryViewed } from "../lib/firebaseHelpers";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { CircleUserRound, Send } from "lucide-react";

const INITIAL_USERS_LIMIT = 10;
const USER_PREVIEW_CACHE_TTL = 60 * 1000;
const userPreviewCache = new Map();

export default function Dishlists() {
  const { user, loading } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [allUsersPool, setAllUsersPool] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [storyGroups, setStoryGroups] = useState([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyGroupIndex, setStoryGroupIndex] = useState(0);

  const attachPreviewData = async (usersList) => {
    return Promise.all(
      usersList.map(async (u) => {
        const cached = userPreviewCache.get(u.id);
        if (cached && Date.now() - cached.cachedAt < USER_PREVIEW_CACHE_TTL) {
          return { ...u, ...cached.value };
        }

        const previewImages = [];
        const pushImage = (dishData) => {
          if (!dishData || previewImages.length >= 9) return;
          previewImages.push(getDishImageUrl(dishData));
        };

        const savedSnap = await getDocs(query(collection(db, "users", u.id, "saved"), limit(9)));
        savedSnap.docs.forEach((d) => pushImage(d.data()));

        if (previewImages.length < 9) {
          const uploadedSnap = await getDocs(
            query(collection(db, "dishes"), where("owner", "==", u.id), limit(9 - previewImages.length))
          );
          uploadedSnap.docs.forEach((d) => pushImage(d.data()));
        }

        const activeStories = await getActiveStoriesForUser(u.id);

        const value = {
          previewImages,
          activeStories,
          followersCount: Array.isArray(u.followers) ? u.followers.length : 0,
        };
        userPreviewCache.set(u.id, { value, cachedAt: Date.now() });

        return {
          ...u,
          ...value,
        };
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
    const withPreview = await attachPreviewData(usersList);
    setUsers(withPreview);
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
      const withPreview = await attachPreviewData(usersList);
      setAllUsersPool(withPreview);
      if (!search.trim()) {
        setHasMoreUsers(users.length < withPreview.length);
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
        pool = await attachPreviewData(usersList);
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
    const source = term ? allUsersPool || [] : users;
    const filtered = term
      ? source.filter((u) => u.displayName?.toLowerCase().includes(term))
      : source;
    return filtered.slice().sort((a, b) => {
      const aStories = (a.activeStories || []).length;
      const bStories = (b.activeStories || []).length;
      if (aStories !== bStories) return bStories - aStories;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
  }, [users, allUsersPool, search]);

  const visibleStoryGroups = useMemo(() => {
    const source = search.trim() ? filteredUsers : (allUsersPool || users);
    return (source || [])
      .filter((u) => (u.activeStories || []).length > 0)
      .sort((a, b) => {
        const aViewed = user?.uid ? (a.activeStories || []).every((story) => (story.viewedBy || []).includes(user.uid)) : false;
        const bViewed = user?.uid ? (b.activeStories || []).every((story) => (story.viewedBy || []).includes(user.uid)) : false;
        if (aViewed !== bViewed) return aViewed ? 1 : -1;
        return (a.displayName || "").localeCompare(b.displayName || "");
      })
      .map((u) => ({
        ownerId: u.id,
        ownerName: u.displayName || "User",
        ownerPhotoURL: u.photoURL || "",
        stories: u.activeStories || [],
      }));
  }, [allUsersPool, filteredUsers, search, user?.uid, users]);

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
    const updateList = (list) =>
      list.map((u) => {
        if (u.id !== userId) return u;
        const followers = Array.isArray(u.followers) ? u.followers : [];
        const nextFollowers = alreadyFollowing
          ? followers.filter((id) => id !== user.uid)
          : Array.from(new Set([...followers, user.uid]));
        return {
          ...u,
          followers: nextFollowers,
          followersCount: nextFollowers.length,
        };
      });
    setUsers((prev) => updateList(prev));
    setAllUsersPool((prev) => (Array.isArray(prev) ? updateList(prev) : prev));
  };

  const handleStoryViewed = async (story, group) => {
    if (!user?.uid || !group?.ownerId || !story?.id) return;
    await markStoryViewed(group.ownerId, story.id, user.uid);
    const patchList = (list) =>
      list.map((item) => {
        if (item.id !== group.ownerId) return item;
        return {
          ...item,
          activeStories: (item.activeStories || []).map((activeStory) =>
            activeStory.id === story.id
              ? {
                  ...activeStory,
                  viewedBy: Array.from(new Set([...(activeStory.viewedBy || []), user.uid])),
                }
              : activeStory
          ),
        };
      });
    setUsers((prev) => patchList(prev));
    setAllUsersPool((prev) => (Array.isArray(prev) ? patchList(prev) : prev));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6 text-black relative pb-24">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dishlists</h1>
        <div className="flex items-center gap-2">
          <Link
            href={user ? "/directs" : "/?auth=1"}
            className="relative w-11 h-11 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-transform hover:scale-[1.02]"
            aria-label="Open directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <Link
            href={user ? "/profile" : "/?auth=1"}
            className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-transform hover:scale-[1.02]"
            aria-label="Open profile"
          >
            <CircleUserRound size={18} />
          </Link>
        </div>
      </div>
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-3.5 rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] border border-black/10 text-black shadow-[0_12px_30px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-black/15 placeholder:text-black/38"
        />
      </div>
      {visibleStoryGroups.length > 0 ? (
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {visibleStoryGroups.map((group, idx) => {
              const viewedAll = user?.uid
                ? group.stories.every((story) => (story.viewedBy || []).includes(user.uid))
                : false;
              return (
                <button
                  key={`story-${group.ownerId}`}
                  type="button"
                  onClick={() => {
                    setStoryGroups(visibleStoryGroups);
                    setStoryGroupIndex(idx);
                    setStoriesOpen(true);
                  }}
                  className="shrink-0 flex flex-col items-center gap-2"
                >
                  <div className={`w-16 h-16 rounded-full p-[3px] ${viewedAll ? "bg-[#C6C6BF]" : "bg-[#2BD36B]"}`}>
                    <div className="w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                      <div className="w-full h-full rounded-full bg-black/10 overflow-hidden flex items-center justify-center text-lg font-bold">
                        {group.ownerPhotoURL ? (
                          <img
                            src={group.ownerPhotoURL}
                            alt={group.ownerName}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (group.ownerName?.[0] || "U").toUpperCase()
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-black/75 max-w-16 truncate">
                    {group.ownerName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
          <div className="grid grid-cols-2 gap-4">
            {filteredUsers.map((u) => {
              const isMe = user?.uid === u.id;
              const alreadyFollowing = u.followers?.includes(user?.uid);
              const previewCells = Array.from({ length: 9 }, (_, idx) => u.previewImages?.[idx] || "");
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl p-3 shadow-md relative overflow-hidden cursor-pointer"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "240px" }}
                  onClick={() => router.push(`/profile/${u.id}`)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!(u.activeStories || []).length) return;
                        const groups = visibleStoryGroups;
                        const nextIndex = groups.findIndex((group) => group.ownerId === u.id);
                        setStoryGroups(groups);
                        setStoryGroupIndex(Math.max(nextIndex, 0));
                        setStoriesOpen(true);
                      }}
                      className={`w-10 h-10 rounded-full p-[2px] ${(u.activeStories || []).length ? ((user?.uid && (u.activeStories || []).every((story) => (story.viewedBy || []).includes(user.uid))) ? "bg-[#C6C6BF]" : "bg-[#2BD36B]") : "bg-transparent"}`}
                    >
                      <div className="w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                        <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center text-lg font-bold overflow-hidden">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt="Profile"
                              loading="lazy"
                              decoding="async"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            u.displayName?.[0] || "U"
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight max-h-9 overflow-hidden">
                        {u.displayName || "User"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {previewCells.map((imageSrc, idx) => (
                      <div
                        key={`${u.id}-preview-${idx}`}
                        className="aspect-square rounded-lg bg-neutral-100 overflow-hidden"
                      >
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt="Dish preview"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_DISH_IMAGE;
                              }}
                          />
                        ) : (
                          <div className="w-full h-full bg-white" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end">
                    {!isMe && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFollow(u.id, alreadyFollowing);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          alreadyFollowing
                            ? "bg-[linear-gradient(135deg,#F4E9D5_0%,#FCF5E7_100%)] text-[#2B2418] border-[#D8C9AF]"
                            : "bg-[linear-gradient(135deg,#EAF7EE_0%,#F4FBF2_100%)] text-[#165D32] border-[#C7E3CB]"
                        }`}
                      >
                        {alreadyFollowing ? "Unfollow" : "Follow"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!search.trim() && hasMoreUsers && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMoreUsers}
                disabled={loadingMoreUsers}
                className="bg-[linear-gradient(135deg,#F4E9D5_0%,#FCF5E7_100%)] text-[#2B2418] px-6 py-3 rounded-full font-semibold border border-[#D8C9AF] shadow-sm disabled:opacity-60"
              >
                {loadingMoreUsers ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      <BottomNav />
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        storyGroups={storyGroups}
        initialGroupIndex={storyGroupIndex}
        onViewed={handleStoryViewed}
      />
    </div>
  );
}
