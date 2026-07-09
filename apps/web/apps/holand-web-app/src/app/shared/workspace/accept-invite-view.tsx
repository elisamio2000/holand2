'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { useWorkspace } from '@/contexts/workspace-context';
import { workspaceService } from '@/services/workspace.service';
import type { WorkspaceInvitePublic } from '@/types/workspace.types';

interface AcceptInviteViewProps {
  token: string;
}

export default function AcceptInviteView({ token }: AcceptInviteViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { setActiveWorkspace } = useWorkspace();
  const [invite, setInvite] = useState<WorkspaceInvitePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await workspaceService.getInvitePublic(token);
        if (!cancelled) setInvite(data);
      } catch {
        if (!cancelled) toast.error(t('workspace.accept.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const sessionEmail = (session?.user as { email?: string })?.email?.toLowerCase();
  const inviteEmail = invite?.email?.toLowerCase();
  const emailMismatch =
    Boolean(sessionEmail && inviteEmail && sessionEmail !== inviteEmail);

  const handleAccept = async () => {
    if (emailMismatch) {
      toast.error(t('workspace.accept.emailMismatch'));
      return;
    }
    setActing(true);
    try {
      const result = await workspaceService.acceptInvite(token);
      setActiveWorkspace(result.group.id);
      await update();
      toast.success(t('workspace.accept.joined'));
      router.push(routes.workspace.settings(result.group.id));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(detail || t('workspace.accept.error'));
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    setActing(true);
    try {
      await workspaceService.declineInvite(token);
      toast.success(t('workspace.accept.declined'));
      router.push('/');
    } catch {
      toast.error(t('workspace.accept.declineError'));
    } finally {
      setActing(false);
    }
  };

  if (loading || status === 'loading') {
    return <Loader variant="spinner" className="mx-auto my-16" />;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-muted p-6 text-center">
        <Title as="h2" className="text-lg font-semibold">
          {t('workspace.accept.signInRequired')}
        </Title>
        <Text className="mt-2 text-sm text-gray-500">{t('workspace.accept.signInHint')}</Text>
        <Button className="mt-4" onClick={() => router.push(`${routes.signIn}?callbackUrl=${encodeURIComponent(routes.workspace.inviteAccept(token))}`)}>
          {t('workspace.accept.signIn')}
        </Button>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-muted p-6 text-center">
        <Text>{t('workspace.accept.invalid')}</Text>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-muted p-6">
      <Title as="h2" className="text-lg font-semibold">
        {t('workspace.accept.title')}
      </Title>
      <Text className="mt-2 text-sm text-gray-600">
        {t('workspace.accept.message', {
          workspace: invite.group_name,
          role: invite.role_name,
        })}
      </Text>
      {invite.inviter_name && (
        <Text className="mt-1 text-xs text-gray-500">
          {t('workspace.accept.invitedBy', { name: invite.inviter_name })}
        </Text>
      )}
      {emailMismatch && (
        <Text className="mt-3 text-sm text-amber-600">{t('workspace.accept.emailMismatch')}</Text>
      )}
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" onClick={handleAccept} isLoading={acting} disabled={emailMismatch}>
          {t('workspace.accept.join')}
        </Button>
        <Button className="flex-1" variant="outline" onClick={handleDecline} isLoading={acting}>
          {t('workspace.accept.decline')}
        </Button>
      </div>
    </div>
  );
}
