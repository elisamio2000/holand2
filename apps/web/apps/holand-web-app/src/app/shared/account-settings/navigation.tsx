'use client';

import Link from 'next/link';
import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useScrollableSlider } from '@core/hooks/use-scrollable-slider';
import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import { useLayout } from '@/layouts/use-layout';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { useBerylliumSidebars } from '@/layouts/beryllium/beryllium-utils';
import { routes } from '@/config/routes';

/**
 * DEV NOTE: Navigation tabs
 * âœ… My Details â€” Connected to backend (UserResponse, UserUpdate)
 * âœ… Profile â€” Partially connected (shows real data, dev warnings for missing fields)
 * âœ… Password â€” Connected to POST /auth/change-password
 * âŒ Team / Billing / Notifications / Integrations â€” Removed (not part of Holand platform)
 *    â†’ If needed later, request backend team to add relevant endpoints
 */
export default function ProfileSettingsNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const menuItems = [
    {
      label: t('account.navigation.myDetails'),
      value: '/account/profile',
    },
    {
      label: t('account.navigation.activity'),
      value: '/account/activity',
    },
    {
      label: t('account.navigation.password'),
      value: '/account/security',
    },
    {
      label: t('adminSettings.tabAppearance'),
      value: routes.account.appearance,
    },
  ];
  const { layout } = useLayout();
  const {
    sliderEl,
    sliderPrevBtn,
    sliderNextBtn,
    scrollToTheRight,
    scrollToTheLeft,
  } = useScrollableSlider();
  const { expandedLeft } = useBerylliumSidebars();
  return (
    <div
      className={cn(
        'sticky z-20 -mx-4 border-b border-muted bg-white px-4 font-medium text-gray-500 shadow-sm dark:bg-gray-50 md:-mx-5 md:px-5 lg:-mx-8 lg:px-8 xl:-mx-6 xl:px-6 3xl:-mx-[33px] 3xl:px-[33px] 4xl:-mx-10 4xl:px-10',
        layout === LAYOUT_OPTIONS.LITHIUM
          ? 'top-[66px] sm:top-[70px] md:top-[73px]'
          : layout === LAYOUT_OPTIONS.BERYLLIUM
            ? 'top-[62px] sm:top-[72px] 2xl:top-[72px]'
            : 'top-0',
        layout === LAYOUT_OPTIONS.BERYLLIUM &&
          expandedLeft &&
          'xl:-ms-1 xl:px-0 3xl:-ms-2 3xl:ps-0 4xl:-ms-2'
      )}
    >
      <div className="relative flex items-center overflow-hidden">
        <Button
          title="Prev"
          variant="text"
          ref={sliderPrevBtn}
          onClick={() => scrollToTheLeft()}
          className="!absolute start-0 top-0.5 z-10 !h-[calc(100%-4px)] w-8 !justify-start bg-gradient-to-r from-white via-white to-transparent px-0 text-gray-500 hover:text-black dark:from-gray-50 dark:via-gray-50 lg:hidden"
        >
          <PiCaretLeftBold className="w-5" />
        </Button>
        <div className="flex h-[52px] items-start overflow-hidden">
          <div
            className="-mb-7 flex w-full gap-3 overflow-x-auto scroll-smooth pb-7 md:gap-5 lg:gap-8"
            ref={sliderEl}
          >
            {menuItems.map((menu, index) => (
              <Link
                href={`${menu.value}`}
                key={`menu-${index}`}
                className={cn(
                  'group relative cursor-pointer whitespace-nowrap py-2.5 font-medium text-gray-500 before:absolute before:bottom-0 before:start-0 before:z-[1] before:h-0.5 before:bg-gray-1000 before:transition-all hover:text-gray-900',
                  menu.value.toLowerCase() === pathname
                    ? 'before:visible before:w-full before:opacity-100'
                    : 'before:invisible before:w-0 before:opacity-0'
                )}
              >
                <Text
                  as="span"
                  className="inline-flex rounded-md px-2.5 py-1.5 transition-all duration-200 group-hover:bg-gray-100/70"
                >
                  {menu.label}
                </Text>
              </Link>
            ))}
          </div>
        </div>
        <Button
          title="Next"
          variant="text"
          ref={sliderNextBtn}
          onClick={() => scrollToTheRight()}
          className="!absolute end-0 top-0.5 z-10 !h-[calc(100%-4px)] w-8 !justify-end bg-gradient-to-l from-white via-white to-transparent px-0 text-gray-500 hover:text-black dark:from-gray-50 dark:via-gray-50 lg:hidden"
        >
          <PiCaretRightBold className="w-5" />
        </Button>
      </div>
    </div>
  );
}
