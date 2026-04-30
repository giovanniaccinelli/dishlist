"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import BottomNav from "../../components/BottomNav";
import {
  FullScreenLoading,
  PeopleGridLoading,
  PeopleInlineLoading,
} from "../../components/AppLoadingState";
import StoryViewerModal from "../../components/StoryViewerModal";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import { getActiveStoriesForUser, getAllDishesFromFirestore, getAvatarTone, getStoryPushStatsForUser, markStoryViewed } from "../lib/firebaseHelpers";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { CircleUserRound, Plus, Search, Send } from "lucide-react";

function StoryStatIcon({ size = 10, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="4.05" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.8" stroke="currentColor" strokeWidth="1.8" opacity="0.88" />
      <path d="M1.35 3.55V8.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0.2 3.55V6.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M2.5 3.55V6.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M1.35 8.7V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const INITIAL_USERS_LIMIT = 10;

const getProfileDishCount = (user) => Number(user.profileDishCount ?? 0);

const sortUsersByProfileDishes = (usersList) =>
  usersList.slice().sort((a, b) => {
    const profileDishDelta = getProfileDishCount(b) - getProfileDishCount(a);
    if (profileDishDelta !== 0) return profileDishDelta;

    const storyDelta = (b.activeStories || []).length - (a.activeStories || []).length;
    if (storyDelta !== 0) return storyDelta;

    return (a.displayName || "").localeCompare(b.displayName || "");
  });

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
  const [visibleUsersLimit, setVisibleUsersLimit] = useState(INITIAL_USERS_LIMIT);
  const [storyGroups, setStoryGroups] = useState([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyGroupIndex, setStoryGroupIndex] = useState(0);
  const [storyActionOpen, setStoryActionOpen] = useState(false);

  const attachPreviewData = (usersList, allDishes, storyStatsByUser = new Map()) => {
    const dishById = new Map(allDishes.map((dish) => [dish.id, dish]));
    const uploadedByOwner = new Map();

    allDishes.forEach((dish) => {
      if (!dish?.owner) return;
      const current = uploadedByOwner.get(dish.owner) || [];
      current.push(dish);
      uploadedByOwner.set(dish.owner, current);
    });

    return usersList.map((u) => {
      const savedDishIds = Array.isArray(u.savedDishes) ? u.savedDishes : [];
      const toTryDishIds = Array.isArray(u.toTryDishes) ? u.toTryDishes : [];
      const uploadedDishes = uploadedByOwner.get(u.id) || [];
      const storyStats = storyStatsByUser.get(u.id) || {};
      const previewImages = [];
      const seenDishIds = new Set();

      const pushImage = (dishData) => {
        const imageUrl = getDishImageUrl(dishData, "thumb");
        const dishId = String(dishData?.id || "");
        if (!imageUrl || !dishId || seenDishIds.has(dishId) || previewImages.length >= 4) return;
        seenDishIds.add(dishId);
        previewImages.push(imageUrl);
      };

      Object.entries(storyStats)
        .sort(([, a], [, b]) => Number(b?.count || 0) - Number(a?.count || 0))
        .forEach(([dishId]) => pushImage(dishById.get(dishId)));

      [...savedDishIds, ...toTryDishIds].forEach((dishId) => pushImage(dishById.get(dishId)));
      uploadedDishes.forEach((dish) => pushImage(dish));

      return {
        ...u,
        previewImages,
        activeStories: [],
        hasActiveStory: Boolean(u.hasActiveStory),
        profileDishCount: savedDishIds.length + toTryDishIds.length + uploadedDishes.length,
      };
    });
  };

  const enrichUsersWithStories = async (usersList) => {
    const storyUsers = usersList.filter((userItem) => userItem.hasActiveStory);
    if (!storyUsers.length) return usersList;

    const storyEntries = await Promise.all(
      storyUsers.map(async (userItem) => [
        userItem.id,
        await getActiveStoriesForUser(userItem.id),
      ])
    );

    const storiesByUserId = new Map(storyEntries);
    return usersList.map((userItem) => ({
      ...userItem,
      activeStories: storiesByUserId.get(userItem.id) || [],
    }));
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const [snapshot, allDishes] = await Promise.all([
        getDocs(collection(db, "users")),
        getAllDishesFromFirestore(),
      ]);
      const usersList = snapshot.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
      }));
      const fastPreviewUsers = attachPreviewData(usersList, allDishes);
      const fastSortedUsers = sortUsersByProfileDishes(fastPreviewUsers);
      setUsers(fastSortedUsers);
      setAllUsersPool(fastSortedUsers);
      setVisibleUsersLimit(INITIAL_USERS_LIMIT);
      setHasMoreUsers(fastSortedUsers.length > INITIAL_USERS_LIMIT);

      void Promise.all(
        usersList.map(async (userItem) => [userItem.id, await getStoryPushStatsForUser(userItem.id)])
      ).then((storyStatsEntries) => {
        const storyStatsByUser = new Map(storyStatsEntries);
        const withStoryPreview = attachPreviewData(usersList, allDishes, storyStatsByUser);
        const sortedWithStoryPreview = sortUsersByProfileDishes(withStoryPreview);
        setUsers(sortedWithStoryPreview);
        setAllUsersPool(sortedWithStoryPreview);
      });

      void enrichUsersWithStories(fastSortedUsers).then((usersWithStories) => {
        const storiesById = new Map(usersWithStories.map((userItem) => [userItem.id, userItem.activeStories || []]));
        setUsers((prev) =>
          sortUsersByProfileDishes(
            prev.map((userItem) => ({
              ...userItem,
              activeStories: storiesById.get(userItem.id) || userItem.activeStories || [],
            }))
          )
        );
        setAllUsersPool((prev) =>
          sortUsersByProfileDishes(
            (prev || []).map((userItem) => ({
              ...userItem,
              activeStories: storiesById.get(userItem.id) || userItem.activeStories || [],
            }))
          )
        );
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAllUsersForSearch = async () => {
    if (allUsersPool) return;
    setSearchLoading(true);
    try {
      await fetchUsers();
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMoreUsers = async () => {
    if (loadingMoreUsers || loadingUsers || search.trim()) return;
    setLoadingMoreUsers(true);
    window.setTimeout(() => {
      setVisibleUsersLimit((prev) => prev + INITIAL_USERS_LIMIT);
      setLoadingMoreUsers(false);
    }, 180);
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
    const source = term ? allUsersPool || [] : allUsersPool || users;
    const filtered = term
      ? source.filter((u) => u.displayName?.toLowerCase().includes(term))
      : source;
    return sortUsersByProfileDishes(filtered);
  }, [users, allUsersPool, search]);

  const visibleUsers = useMemo(() => {
    if (search.trim()) return filteredUsers;
    return filteredUsers.slice(0, visibleUsersLimit);
  }, [filteredUsers, search, visibleUsersLimit]);

  useEffect(() => {
    if (search.trim()) {
      setHasMoreUsers(false);
      return;
    }
    setHasMoreUsers(visibleUsersLimit < filteredUsers.length);
  }, [filteredUsers.length, search, visibleUsersLimit]);

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
    return <FullScreenLoading title="Loading people" />;
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dishlists</h1>
        <div className="flex items-center gap-2">
          <Link
            href={user ? "/directs" : "/?auth=1"}
            className="top-action-btn relative"
            aria-label="Open directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <Link
            href={user ? "/profile" : "/?auth=1"}
            className="top-action-btn"
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
      {(visibleStoryGroups.length > 0 || user) ? (
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {user ? (
              <button
                type="button"
                onClick={() => setStoryActionOpen(true)}
                className="shrink-0 flex flex-col items-center gap-2"
              >
                <div className="no-accent-border w-16 h-16 rounded-full p-[3px] bg-[#2BD36B]">
                  <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                    <div className="no-accent-border w-full h-full rounded-full bg-black/6 overflow-hidden flex items-center justify-center text-[#2BD36B]">
                      <StoryStatIcon size={28} className="shrink-0" />
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-black/75 max-w-16 text-center leading-[1.1]">
                  What are you eating?
                </span>
              </button>
            ) : null}
            {visibleStoryGroups.map((group, idx) => {
              const viewedAll = user?.uid
                ? group.stories.every((story) => (story.viewedBy || []).includes(user.uid))
                : false;
              const ownerTone = getAvatarTone(group.ownerName || "");
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
                  <div className={`no-accent-border w-16 h-16 rounded-full p-[3px] ${viewedAll ? "bg-[#C6C6BF]" : "bg-[#2BD36B]"}`}>
                    <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                        <div
                          className="no-accent-border w-full h-full rounded-full bg-black/10 overflow-hidden flex items-center justify-center text-lg font-bold"
                          style={group.ownerPhotoURL ? undefined : { backgroundColor: ownerTone.bg }}
                        >
                        {group.ownerPhotoURL ? (
                          <img
                            src={group.ownerPhotoURL}
                            alt={group.ownerName}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span style={{ color: ownerTone.text }}>{(group.ownerName?.[0] || "U").toUpperCase()}</span>
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
        <PeopleGridLoading />
      ) : search.trim() && searchLoading ? (
        <PeopleGridLoading searching />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No users found.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-3.5">
            {visibleUsers.map((u) => {
              const isMe = user?.uid === u.id;
              const alreadyFollowing = u.followers?.includes(user?.uid);
              const previewCells = Array.from({ length: 4 }, (_, idx) => u.previewImages?.[idx] || "");
              const hasAnyDishes = (u.profileDishCount || 0) > 0;
              const avatarTone = getAvatarTone(u.displayName || "");
              return (
                <div
                  key={u.id}
                  className={`bg-white rounded-2xl p-2.5 shadow-md relative overflow-hidden cursor-pointer ${hasAnyDishes ? "" : "min-h-[5.8rem]"}`}
                  style={{ contentVisibility: "auto", containIntrinsicSize: hasAnyDishes ? "226px" : "96px" }}
                  onClick={() => router.push(`/profile/${encodeURIComponent(u.id)}`)}
                >
                  <div className="mb-2.5 flex items-stretch gap-2.5">
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
                      className={`no-accent-border h-12 w-12 shrink-0 rounded-full p-[2px] ${(u.activeStories || []).length ? ((user?.uid && (u.activeStories || []).every((story) => (story.viewedBy || []).includes(user.uid))) ? "bg-[#C6C6BF]" : "bg-[#2BD36B]") : "bg-transparent"}`}
                    >
                      <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                        <div
                          className="no-accent-border w-full h-full rounded-full bg-black/10 flex items-center justify-center text-lg font-bold overflow-hidden"
                          style={u.photoURL ? undefined : { backgroundColor: avatarTone.bg }}
                        >
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt="Profile"
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span style={{ color: avatarTone.text }}>{u.displayName?.[0] || "U"}</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex min-h-12 min-w-0 flex-1 flex-col justify-between">
                      <div className="min-w-0 text-sm font-semibold leading-tight">
                        <div className="line-clamp-2">{u.displayName || "User"}</div>
                      </div>
                      {!isMe && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFollow(u.id, alreadyFollowing);
                          }}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition self-start ${
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

                  {hasAnyDishes ? (
                    <div className="grid grid-cols-2 gap-2">
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
                  ) : null}

                </div>
              );
            })}
          </div>

          {!search.trim() && hasMoreUsers && (
            <div className="mt-6 mb-3 flex justify-center">
              {loadingMoreUsers ? (
                <div className="w-full">
                  <PeopleInlineLoading />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={loadMoreUsers}
                  className="rounded-full border-2 border-[#D9B550] bg-[linear-gradient(180deg,#FFF2C9_0%,#F3D88C_100%)] px-5 py-3 text-sm font-semibold text-[#7A5400] shadow-[0_12px_26px_rgba(217,181,80,0.24)]"
                >
                  Load more
                </button>
              )}
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
        currentUser={user}
      />
      <AnimatePresence>
        {storyActionOpen && (
          <motion.div
            className="fixed inset-0 z-[90] overflow-y-auto bg-black/45 backdrop-blur-sm flex items-center justify-center p-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStoryActionOpen(false)}
          >
            <motion.div
              className="no-accent-border my-auto w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-[2rem] bg-white p-4 shadow-2xl border border-black/10"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setStoryActionOpen(false)}
                  className="text-sm text-black/55"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/upload?story=1");
                  }}
                  className="w-full min-h-[15.5rem] rounded-[2rem] bg-[rgba(255,255,255,0.72)] text-black px-8 py-8 text-left shadow-[0_18px_40px_rgba(230,70,70,0.12)] transition-transform hover:scale-[1.01] border-[3px] border-[#E64646] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[2.15rem] font-semibold leading-none">Create dish</p>
                        <p className="mt-4 text-base text-black/78">Post directly to your story.</p>
                      </div>
                      <div className="size-16 rounded-[1.4rem] bg-[#E64646] text-white flex items-center justify-center shadow-md border-[2px] border-[#E64646]/55 shrink-0 aspect-square">
                        <Plus size={32} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                        Steps
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "Name", color: "#E64646" },
                          { label: "Details", color: "#F59E0B" },
                          { label: "Recipe", color: "#23C268" },
                          { label: "Story", color: "#111111" },
                        ].map((step) => (
                          <div key={step.label}>
                            <div className="mb-2 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                            <div className="text-[0.72rem] font-medium text-black/72">{step.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/dishes?storyPicker=1");
                  }}
                  className="w-full min-h-[15.5rem] rounded-[2rem] border-[3px] border-[#F0A623] bg-[rgba(255,255,255,0.72)] px-8 py-8 text-left shadow-[0_18px_40px_rgba(240,166,35,0.12)] transition-transform hover:scale-[1.01] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[2.15rem] font-semibold leading-none text-black">Find dish</p>
                        <p className="mt-4 text-base text-black/78">Choose an existing dish to share.</p>
                      </div>
                      <div className="size-16 rounded-[1.4rem] bg-[#F0A623] text-white flex items-center justify-center shadow-md border-[2px] border-[#F0A623]/55 shrink-0 aspect-square">
                        <Search size={28} />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-black/65">
                      <p>Pick from your uploaded dishes or saved DishLists.</p>
                      <p>Share it instantly to your story.</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
