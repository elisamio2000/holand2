'use client';

import { useEffect, useState } from 'react';
import { SubmitHandler, Controller } from 'react-hook-form';
import { PiEnvelopeSimple, PiSealCheckFill } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { Form } from '@core/ui/form';
import { Button, Title, Text, Input, Badge, Loader } from 'rizzui';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import FormGroup from '@/app/shared/form-group';
import FormFooter, { profileFormFooterClassName } from '@core/components/form-footer';
import { useLayout } from '@/layouts/use-layout';
import { useBerylliumSidebars } from '@/layouts/beryllium/beryllium-utils';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { adminService } from '@/services/admin.service';
import { authService } from '@/services/auth.service';
import type { UserResponse } from '@/types/auth.types';
import { z } from 'zod';
import {
  isValidAvatarUrl,
  resolveAvatarSrc,
} from '@/utils/avatar/resolve-avatar-src';
import { getApiErrorMessage } from '@/lib/api-errors';

/**
 * DEV NOTE: Backend fields mapping for Profile tab
 * ✅ Available: username, email, display_name, avatar_url
 * ❌ NOT available: website, bio (description), job title (role select),
 *    alternative email, portfolio upload
 *    → These require backend schema extension (UserUpdate model)
 */

// Simplified schema using only backend-supported fields
const profileSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  display_name: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  avatar_url: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => isValidAvatarUrl(value ?? ''), {
      message: 'Invalid avatar URL',
    }),
});
type ProfileFormData = z.infer<typeof profileSchema>;

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

async function buildAvatarBlobFromEditor(
  src: string,
  zoom: number,
  rotationDeg: number,
  offsetXPercent: number,
  offsetYPercent: number,
  size = 512
): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context is not available');

  const containScale = Math.min(size / image.width, size / image.height);
  const finalScale = containScale * zoom;
  const offsetX = (offsetXPercent / 100) * (size / 2);
  const offsetY = (offsetYPercent / 100) * (size / 2);

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to build avatar image'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function resolveProfileApiErrorMessage(
  err: unknown,
  fallback: string
): string {
  return getApiErrorMessage(err, fallback);
}

export default function ProfileSettingsView() {
  const { t } = useTranslation();
  const { data: session, update: updateSession } = useSession();
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [avatarEditorSrc, setAvatarEditorSrc] = useState('');
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarRotation, setAvatarRotation] = useState(0);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      if (!session?.user?.id) return;
      try {
        const [me, adminUser] = await Promise.all([
          authService.me(),
          adminService.getUserById(session.user.id).catch(() => null),
        ]);

        setUserData({
          id: session.user.id,
          username: me.username ?? adminUser?.username ?? session.user.username ?? '',
          email: me.email ?? adminUser?.email ?? session.user.email ?? '',
          display_name:
            me.display_name ??
            adminUser?.display_name ??
            session.user.displayName ??
            null,
          avatar_url:
            me.avatar_url ??
            adminUser?.avatar_url ??
            session.user.avatarUrl ??
            null,
          role: me.role ?? adminUser?.role ?? null,
          is_active: me.is_active ?? adminUser?.is_active,
        });
      } catch (err: unknown) {
        toast.error(
          resolveProfileApiErrorMessage(err, t('account.profileSettings.loadError'))
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, [session?.user?.id, session?.user?.username, session?.user?.email, session?.user?.displayName, session?.user?.avatarUrl, t]);

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    try {
      const updated = await adminService.updateUser(session.user.id, {
        display_name: data.display_name || null,
        email: data.email || null,
        avatar_url: data.avatar_url || null,
      });
      setUserData(updated);
      const avatarPreview = resolveAvatarSrc(
        data.avatar_url,
        session.user.id || updated.username || 'user'
      );
      await updateSession({
        avatarUrl: data.avatar_url || null,
        image: avatarPreview,
        displayName: data.display_name || session.user.displayName,
      });
      toast.success(<Text as="b">{t('account.profileSettings.saveSuccess')}</Text>);
    } catch (err: unknown) {
      toast.error(resolveProfileApiErrorMessage(err, t('account.profileSettings.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (
    file: File,
    onChange: (value: string) => void
  ): Promise<void> => {
    setIsAvatarUploading(true);
    try {
      const uploaded = await authService.uploadMyAvatar(file);
      const nextAvatarUrl = uploaded?.avatar_url ?? '';
      onChange(nextAvatarUrl);
      const avatarPreview = resolveAvatarSrc(
        nextAvatarUrl,
        session?.user?.id || userData?.username || 'user'
      );
      await updateSession({
        avatarUrl: nextAvatarUrl,
        image: avatarPreview,
      });
      toast.success(t('account.profileSettings.avatarUploadSuccess'));
      console.info('[ProfileSettingsView] Avatar uploaded via gateway auth endpoint');
    } catch (err: unknown) {
      toast.error(
        resolveProfileApiErrorMessage(err, t('account.profileSettings.avatarUploadError'))
      );
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async (onChange: (value: string) => void): Promise<void> => {
    setIsAvatarUploading(true);
    try {
      await authService.deleteMyAvatar();
      onChange('');
      await updateSession({ avatarUrl: null, image: null });
      toast.success(t('account.profileSettings.avatarDeleteSuccess'));
      console.info('[ProfileSettingsView] Avatar removed via gateway auth endpoint');
    } catch (err: unknown) {
      toast.error(
        resolveProfileApiErrorMessage(err, t('account.profileSettings.avatarDeleteError'))
      );
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const openAvatarEditor = (): void => {
    setAvatarEditorSrc('');
    setAvatarZoom(1);
    setAvatarRotation(0);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
    setIsAvatarEditorOpen(true);
  };

  const onPickAvatarFile = async (file: File): Promise<void> => {
    const isAllowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type);
    if (!isAllowed) {
      toast.error(t('account.profileSettings.avatarEditorTypeError'));
      return;
    }
    const src = await readFileAsDataUrl(file);
    setAvatarEditorSrc(src);
  };

  const applyEditedAvatarUpload = async (
    onChange: (value: string) => void
  ): Promise<void> => {
    if (!avatarEditorSrc) {
      toast.error(t('account.profileSettings.avatarEditorNoFile'));
      return;
    }
    try {
      const blob = await buildAvatarBlobFromEditor(
        avatarEditorSrc,
        avatarZoom,
        avatarRotation,
        avatarOffsetX,
        avatarOffsetY
      );
      const editedFile = new File([blob], 'avatar-edited.png', { type: 'image/png' });
      await handleAvatarUpload(editedFile, onChange);
      setIsAvatarEditorOpen(false);
    } catch (error: unknown) {
      console.error('[ProfileSettingsView] Avatar editor apply failed:', error);
      toast.error(t('account.profileSettings.avatarEditorApplyError'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  return (
    <>
      <Form<ProfileFormData>
        validationSchema={profileSchema}
        onSubmit={onSubmit}
        className="@container"
        useFormProps={{
          mode: 'onChange',
          defaultValues: {
            username: userData?.username || '',
            display_name: userData?.display_name || '',
            email: userData?.email || '',
            avatar_url: userData?.avatar_url || '',
          },
        }}
      >
        {({ register, control, watch, formState: { errors } }) => {
          const avatarUrl = watch('avatar_url') ?? '';
          const avatarPreview = resolveAvatarSrc(
            avatarUrl,
            session?.user?.id || userData?.username || 'user'
          );

          return (
            <>
              <ProfileHeader
                title={userData?.display_name || userData?.username || t('account.profileSettings.user')}
                description={t('account.profileSettings.title')}
                avatarSrc={avatarPreview}
              />

              <div className="mx-auto mb-10 grid w-full max-w-screen-2xl gap-7 divide-y divide-dashed divide-gray-200 @2xl:gap-9 @3xl:gap-11">
                <FormGroup
                  title={t('account.profileSettings.username')}
                  className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
                >
                  <Input
                    className="col-span-full"
                    placeholder={t('account.profileSettings.usernamePlaceholder')}
                    {...register('username')}
                    error={errors.username?.message}
                    disabled
                    helperText={t('account.profileSettings.usernameHelper')}
                  />
                </FormGroup>

                <FormGroup
                  title={t('account.profileSettings.displayName')}
                  className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
                >
                  <Input
                    className="col-span-full"
                    placeholder={t('account.profileSettings.displayNamePlaceholder')}
                    {...register('display_name')}
                    error={errors.display_name?.message}
                  />
                </FormGroup>

                <FormGroup
                  title={t('account.profileSettings.email')}
                  className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
                >
                  <Input
                    prefix={
                      <PiEnvelopeSimple className="h-6 w-6 text-gray-500" />
                    }
                    type="email"
                    className="col-span-full"
                    placeholder={t('account.profileSettings.emailPlaceholder')}
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </FormGroup>

                <FormGroup
                  title={t('account.profileSettings.avatarUploadTitle')}
                  description={t('account.profileSettings.avatarBackendNote')}
                  layout="stacked"
                  className="pt-7 @2xl:pt-9 @3xl:pt-11"
                >
                  <Controller
                    name="avatar_url"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-dashed border-muted p-4">
                          <Text className="mb-2 text-sm font-medium text-gray-700">
                            {t('account.profileSettings.avatarUploadTitle')}
                          </Text>
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              variant="solid"
                              size="sm"
                              onClick={openAvatarEditor}
                            >
                              {t('account.profileSettings.avatarOpenEditorBtn')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              isLoading={isAvatarUploading}
                              onClick={() => void handleAvatarDelete(field.onChange)}
                            >
                              {t('account.profileSettings.avatarRemoveBtn')}
                            </Button>
                          </div>
                        </div>

                        {isAvatarEditorOpen ? (
                          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]">
                            <div className="w-full max-w-lg rounded-xl border border-muted bg-gray-0 p-4 shadow-2xl dark:bg-gray-50 sm:p-5">
                              <div className="mb-3 flex items-start justify-between gap-3 border-b border-dashed border-muted pb-3">
                                <div>
                                  <Title as="h4" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                                    {t('account.profileSettings.avatarEditorTitle')}
                                  </Title>
                                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                                    {t('account.profileSettings.avatarEditorSubtitle')}
                                  </Text>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsAvatarEditorOpen(false)}
                                >
                                  {t('account.profileSettings.cancelBtn')}
                                </Button>
                              </div>

                              <div className="mb-4 space-y-4">
                                <input
                                  id="avatar-editor-file-input"
                                  type="file"
                                  accept="image/png,image/jpeg,image/gif,image/webp"
                                  className="hidden"
                                  onChange={(event) => {
                                    const selected = event.target.files?.[0];
                                    if (selected) {
                                      void onPickAvatarFile(selected);
                                    }
                                    event.target.value = '';
                                  }}
                                />
                                <div className="flex justify-center">
                                  <label htmlFor="avatar-editor-file-input" className="group block cursor-pointer">
                                    <div
                                      className={cn(
                                        'relative h-56 w-56 overflow-hidden rounded-full border-[3px] bg-blue-lighter transition-all sm:h-60 sm:w-60',
                                        isDragOver
                                          ? 'border-primary ring-4 ring-primary/20'
                                          : 'border-muted group-hover:border-primary/70 group-hover:ring-2 group-hover:ring-primary/10'
                                      )}
                                      onDragOver={(event) => {
                                        event.preventDefault();
                                        setIsDragOver(true);
                                      }}
                                      onDragLeave={() => setIsDragOver(false)}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        setIsDragOver(false);
                                        const dropped = event.dataTransfer.files?.[0];
                                        if (dropped) {
                                          void onPickAvatarFile(dropped);
                                        }
                                      }}
                                    >
                                      {avatarEditorSrc ? (
                                        <div
                                          className="absolute left-1/2 top-1/2 h-full w-full"
                                          style={{
                                            transform: `translate(calc(-50% + ${avatarOffsetX}%), calc(-50% + ${avatarOffsetY}%)) scale(${avatarZoom}) rotate(${avatarRotation}deg)`,
                                            transformOrigin: 'center center',
                                          }}
                                        >
                                          <img
                                            src={avatarEditorSrc}
                                            alt="avatar-editor-preview"
                                            className="h-full w-full object-contain"
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                                          <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {t('account.profileSettings.avatarEditorEmpty')}
                                          </Text>
                                          <Text className="text-[11px] text-gray-500">
                                            {t('account.profileSettings.avatarEditorDropHint')}
                                          </Text>
                                        </div>
                                      )}

                                      {avatarEditorSrc ? (
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/45 px-2 py-1 text-center text-[11px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                          {t('account.profileSettings.avatarEditorDropHint')}
                                        </div>
                                      ) : null}
                                    </div>
                                  </label>
                                </div>

                                <div className="space-y-3 rounded-lg border border-muted bg-gray-50/80 p-3 dark:bg-gray-100/70">
                                  <div>
                                    <Text className="mb-1 text-xs font-medium text-gray-600">
                                      {t('account.profileSettings.avatarEditorZoom')}
                                    </Text>
                                    <input
                                      type="range"
                                      min={1}
                                      max={2.5}
                                      step={0.01}
                                      value={avatarZoom}
                                      className="w-full accent-primary"
                                      onChange={(event) =>
                                        setAvatarZoom(Number(event.target.value))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Text className="mb-1 text-xs font-medium text-gray-600">
                                      {t('account.profileSettings.avatarEditorRotation')}
                                    </Text>
                                    <input
                                      type="range"
                                      min={-180}
                                      max={180}
                                      step={1}
                                      value={avatarRotation}
                                      className="w-full accent-primary"
                                      onChange={(event) =>
                                        setAvatarRotation(Number(event.target.value))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Text className="mb-1 text-xs font-medium text-gray-600">
                                      {t('account.profileSettings.avatarEditorOffsetX')}
                                    </Text>
                                    <input
                                      type="range"
                                      min={-100}
                                      max={100}
                                      step={1}
                                      value={avatarOffsetX}
                                      className="w-full accent-primary"
                                      onChange={(event) =>
                                        setAvatarOffsetX(Number(event.target.value))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Text className="mb-1 text-xs font-medium text-gray-600">
                                      {t('account.profileSettings.avatarEditorOffsetY')}
                                    </Text>
                                    <input
                                      type="range"
                                      min={-100}
                                      max={100}
                                      step={1}
                                      value={avatarOffsetY}
                                      className="w-full accent-primary"
                                      onChange={(event) =>
                                        setAvatarOffsetY(Number(event.target.value))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap justify-end gap-2 border-t border-dashed border-muted pt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsAvatarEditorOpen(false)}
                                >
                                  {t('account.profileSettings.cancelBtn')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAvatarZoom(1);
                                    setAvatarRotation(0);
                                    setAvatarOffsetX(0);
                                    setAvatarOffsetY(0);
                                  }}
                                >
                                  Reset
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  isLoading={isAvatarUploading}
                                  onClick={() => void applyEditedAvatarUpload(field.onChange)}
                                >
                                  {t('account.profileSettings.avatarEditorApplyBtn')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                      </div>
                    )}
                  />
                  {errors.avatar_url?.message ? (
                    <Text className="text-sm text-red-500">
                      {errors.avatar_url.message}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-gray-500">
                    {t('account.profileSettings.avatarBackendNote')}
                  </Text>
                </FormGroup>

                {/* Real data from session: Roles & Sections */}
                <FormGroup
                  title={t('account.profileSettings.rolesAndAccess')}
                  description={t('account.profileSettings.rolesDesc')}
                  className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
                >
                  <div className="col-span-full space-y-4">
                    <div>
                      <Text className="mb-2 text-sm font-medium text-gray-700">{t('account.profileSettings.systemRoles')}</Text>
                      <div className="flex flex-wrap gap-2">
                        {(session?.user?.roles || [userData?.role].filter(Boolean)).map((role: string) => (
                          <Badge key={role} variant="flat" color="primary" className="capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Text className="mb-2 text-sm font-medium text-gray-700">{t('account.profileSettings.allowedSections')}</Text>
                      <div className="flex flex-wrap gap-2">
                        {(session?.user?.allowedSections || []).map((section: string) => (
                          <Badge key={section} variant="outline" color="secondary">
                            {section}
                          </Badge>
                        ))}
                        {(!session?.user?.allowedSections || session.user.allowedSections.length === 0) && (
                          <Text className="text-sm text-gray-400">{t('common.noSectionsAssigned')}</Text>
                        )}
                      </div>
                    </div>
                  </div>
                </FormGroup>
              </div>

              <FormFooter
                isLoading={isSaving}
                altBtnText={t('account.profileSettings.cancelBtn')}
                submitBtnText={t('account.profileSettings.saveBtn')}
                sticky={false}
                className={profileFormFooterClassName}
              />
            </>
          );
        }}
      </Form>
    </>
  );
}

export function ProfileHeader({
  title,
  description,
  avatarSrc,
  children,
}: React.PropsWithChildren<{
  title: string;
  description?: string;
  avatarSrc?: string;
}>) {
  const { layout } = useLayout();
  const { expandedLeft } = useBerylliumSidebars();

  return (
    <div
      className={cn(
        'relative z-0 -mx-4 px-4 pt-28 before:absolute before:start-0 before:top-0 before:h-40 before:w-full before:bg-gradient-to-r before:from-[#F8E1AF] before:to-[#F6CFCF] @3xl:pt-[190px] @3xl:before:h-[calc(100%-120px)] dark:before:from-[#bca981] dark:before:to-[#cbb4b4] md:-mx-5 md:px-5 lg:-mx-8 lg:px-8 xl:-mx-6 xl:px-6 3xl:-mx-[33px] 3xl:px-[33px] 4xl:-mx-10 4xl:px-10',
        layout === LAYOUT_OPTIONS.BERYLLIUM && expandedLeft
          ? 'before:start-5 3xl:before:start-[25px]'
          : 'xl:before:w-[calc(100%_+_10px)]'
      )}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-screen-2xl flex-wrap items-end justify-start gap-6 border-b border-dashed border-muted pb-10">
        <div className="relative -top-1/3 aspect-square w-[110px] overflow-hidden rounded-full border-[6px] border-white bg-gray-100 shadow-profilePic @2xl:w-[130px] @5xl:-top-2/3 @5xl:w-[150px] dark:border-gray-50 3xl:w-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc || '/logo.png'}
            alt="profile-pic"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <Title
            as="h2"
            className="mb-2 inline-flex items-center gap-3 text-xl font-bold text-gray-900"
          >
            {title}
            <PiSealCheckFill className="h-5 w-5 text-primary md:h-6 md:w-6" />
          </Title>
          {description ? (
            <Text className="text-sm text-gray-500">{description}</Text>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
