'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import cn from '@core/utils/class-names';
import { getEffectiveWorkspaceBranding } from '@/lib/workspace-branding';
import { getWorkspaceIconByKey } from '@/lib/workspace-icon-catalog';

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
} as const;

const ICON_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

interface WorkspaceAvatarProps {
  workspaceId: string;
  className?: string;
  size?: keyof typeof SIZES;
}

export default function WorkspaceAvatar({
  workspaceId,
  className,
  size = 'md',
}: WorkspaceAvatarProps) {
  const [branding, setBranding] = useState(() => getEffectiveWorkspaceBranding(workspaceId));

  useEffect(() => {
    const refresh = () => setBranding(getEffectiveWorkspaceBranding(workspaceId));
    refresh();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ workspaceId?: string }>).detail;
      if (
        !detail?.workspaceId ||
        detail.workspaceId === workspaceId ||
        detail.workspaceId === '__global__'
      ) {
        refresh();
      }
    };
    window.addEventListener('Holand:workspace-branding-changed', onChange);
    return () => window.removeEventListener('Holand:workspace-branding-changed', onChange);
  }, [workspaceId]);

  const { Icon } = getWorkspaceIconByKey(branding.iconKey);
  const showImage = branding.avatarKind === 'image' && branding.imageUrl;

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/5',
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {showImage ? (
        <Image
          src={branding.imageUrl!}
          alt=""
          fill
          className="object-cover"
          unoptimized={branding.imageUrl!.startsWith('data:') || branding.imageUrl!.startsWith('blob:')}
        />
      ) : (
        <Icon className={cn(ICON_SIZES[size], 'text-primary')} />
      )}
    </span>
  );
}

