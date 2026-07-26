export interface SocialAccount {
  id: number;
  provider: string;
  providerUserId: string;
  createdAt: string;
}

export type FollowStatus = 'none' | 'pending' | 'following' | 'declined' | 'cancelled' | 'blocked';

export interface User {
  id: number;
  email: string;
  fullName?: string;
  profileImage?: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  socialAccounts: SocialAccount[];
  twoFactorEnabled: boolean;
  hasSeenOnboarding: boolean;
  isEmailVerified: boolean;
  emailVerifiedAt?: string;

  // Extended fields for social features
  pseudo?: string;
  location?: string;
  bio?: string;
  website?: string;
  birth_date?: string;
  actionsCount: number;
  postsCount: number;
  groupsCount: number;
  badgesCount: number;
  level: number;
  xp: number;
  maxXp: number;
  interests: string[];
  followers: number;
  following: number;
  points: number;
  isOnline: boolean;
  lastActive?: string;
  coverImageUrl?: string;
  badges?: string[];
  isFollowing: boolean;
  isBlocked: boolean;
  followStatus: FollowStatus;
  isPending: boolean;
  hasRequestedMe: boolean;
  hasBlocked: boolean;
}

export function parseUserFromJson(json: any): User {
  if (!json) throw new Error('User JSON is empty');
  
  const followStatusStr = json.follow_status as string | undefined;
  let followStatus: FollowStatus = 'none';
  if (followStatusStr) {
    const lower = followStatusStr.toLowerCase();
    if (['pending', 'following', 'declined', 'cancelled', 'blocked'].includes(lower)) {
      followStatus = lower as FollowStatus;
    }
  }

  const isFollowing = followStatus === 'following' || !!json.is_following;
  const isPending = followStatus === 'pending' || !!json.is_pending;

  return {
    id: json.id,
    email: json.email,
    fullName: json.full_name,
    profileImage: json.profile_image,
    isActive: json.is_active ?? true,
    roles: Array.isArray(json.roles) ? json.roles.map((r: any) => String(r)) : [],
    createdAt: json.created_at || new Date().toISOString(),
    socialAccounts: Array.isArray(json.social_accounts)
      ? json.social_accounts.map((sa: any) => ({
          id: sa.id,
          provider: sa.provider,
          providerUserId: sa.provider_user_id,
          createdAt: sa.created_at,
        }))
      : [],
    twoFactorEnabled: !!json.two_factor_enabled,
    hasSeenOnboarding: !!json.has_seen_onboarding,
    isEmailVerified: !!json.is_email_verified,
    emailVerifiedAt: json.email_verified_at,
    
    // Extended fields
    pseudo: json.pseudo,
    location: json.location,
    bio: json.bio,
    website: json.website,
    birth_date: json.birth_date,
    actionsCount: json.actions_count ?? 0,
    postsCount: json.posts_count ?? 0,
    groupsCount: json.groups_count ?? 0,
    badgesCount: json.badges_count ?? 0,
    level: json.level ?? 1,
    xp: json.xp ?? 0,
    maxXp: json.max_xp ?? 1000,
    interests: Array.isArray(json.interests) ? json.interests.map((i: any) => String(i)) : [],
    followers: json.followers ?? 0,
    following: json.following ?? 0,
    points: json.points ?? 0,
    isOnline: !!json.is_online,
    lastActive: json.last_active,
    coverImageUrl: json.cover_image_url,
    badges: Array.isArray(json.badges) ? json.badges.map((b: any) => String(b)) : [],
    isFollowing,
    isBlocked: !!json.is_blocked,
    followStatus,
    isPending,
    hasRequestedMe: !!json.has_requested_me,
    hasBlocked: !!json.has_blocked,
  };
}
