"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { getActiveStoriesForUser, getAllDishesFromFirestore, markStoryViewed } from "../lib/firebaseHelpers";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { CircleUserRound, Send } from "lucide-react";

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
  const peopleLoadMoreRef = useRef(null);

  const attachPreviewData = (usersList, allDishes) => {
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
      const previewImages = [];
      const seen = new Set();

      const pushImage = (dishData) => {
        const imageUrl = getDishImageUrl(dishData, "thumb");
        if (!imageUrl || seen.has(imageUrl) || previewImages.length >= 9) return;
        seen.add(imageUrl);
        previewImages.push(imageUrl);
      };

      savedDishIds.forEach((dishId) => pushImage(dishById.get(dishId)));
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
        id: docSnap.id,
        ...docSnap.data(),
      }));
      const withPreview = attachPreviewData(usersList, allDishes);
      const sortedUsers = sortUsersByProfileDishes(withPreview);
      setUsers(sortedUsers);
      setAllUsersPool(sortedUsers);
      setVisibleUsersLimit(INITIAL_USERS_LIMIT);
      setHasMoreUsers(sortedUsers.length > INITIAL_USERS_LIMIT);
      void enrichUsersWithStories(sortedUsers).then((usersWithStories) => {
        const sortedWithStories = sortUsersByProfileDishes(usersWithStories);
        setUsers(sortedWithStories);
        setAllUsersPool(sortedWithStories);
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

  useEffect(() => {
    if (search.trim() || !hasMoreUsers || loadingMoreUsers || loadingUsers) return;

    const node = peopleLoadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreUsers();
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreUsers, loadingMoreUsers, loadingUsers, search, visibleUsers.length]);

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
            {hasUnreadDirects ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
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
              const previewCells = Array.from({ length: 9 }, (_, idx) => u.previewImages?.[idx] || "");
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl p-2.5 shadow-md relative overflow-hidden cursor-pointer"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "226px" }}
                  onClick={() => router.push(`/profile/${u.id}`)}
                >
                  <div className="mb-3 flex items-start gap-2.5">
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
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 pt-0.5">
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
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition ${
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

                  <div className="grid grid-cols-3 gap-1.5">
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

                </div>
              );
            })}
          </div>

          {!search.trim() && hasMoreUsers && (
            <div ref={peopleLoadMoreRef} className="mt-6 mb-3">
              {loadingMoreUsers ? <PeopleInlineLoading /> : <div className="h-10" aria-hidden="true" />}
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
