import Header from '@/layouts/hydrogen/header';
import Sidebar from '@/layouts/hydrogen/sidebar';
import NavRouteGuard from '@/layouts/nav-route-guard';

export default function HydrogenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-[100dvh] min-h-0 w-full flex-1 overflow-hidden">
      <Sidebar className="fixed hidden xl:block dark:bg-gray-50" />
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden xl:ms-[270px] xl:w-[calc(100%-270px)] 2xl:ms-72 2xl:w-[calc(100%-288px)]">
        <Header />
        <div
          data-app-main-scroll
          className="flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto overflow-x-hidden px-4 pb-6 pt-2 md:px-5 lg:px-6 lg:pb-8 3xl:px-8 3xl:pt-4 4xl:px-10 4xl:pb-9"
        >
          <NavRouteGuard>{children}</NavRouteGuard>
        </div>
      </div>
    </main>
  );
}
