'use client';

import { Avatar } from 'rizzui';
import cn from '@core/utils/class-names';
import { useMemo } from 'react';
import { resolveAvatarSrc } from '@/utils/dicebear/dicebear-avatar-url';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  fallbackSeed: string;
  name?: string;
  className?: string;
  avatarProps?: Omit<React.ComponentProps<typeof Avatar>, 'src' | 'name' | 'className'>;
}

/**
 * Renders a user avatar from avatar_url (including dicebear: config) or a deterministic fallback.
 */
export default function UserAvatar({
  avatarUrl,
  fallbackSeed,
  name,
  className,
  avatarProps,
}: UserAvatarProps) {
  const src = useMemo(
    () => resolveAvatarSrc(avatarUrl, fallbackSeed),
    [avatarUrl, fallbackSeed]
  );

  return (
    <Avatar
      src={src}
      name={name ?? fallbackSeed}
      className={cn(className)}
      {...avatarProps}
    />
  );
}
