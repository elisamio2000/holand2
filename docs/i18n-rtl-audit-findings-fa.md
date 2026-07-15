# یافته‌های ممیزی i18n/RTL — Phase F (WS-F)

آخرین به‌روزرسانی: 2026-07-14
مالک: Worker F (Phase F: Production Hardening)
ابزار: `pnpm i18n:scan` / `pnpm i18n:check` در `apps/web/apps/holand-web-app`

## 1) اصلاحات ابزار (پیش از هر گزارش، این باگ‌ها در خود ابزار پیدا و رفع شد)

1. **باگ مسیر خروج اسکن (رفع‌شده)** — `src/platform/i18n-governance/index.mjs` مسیر
   `BASELINE_PATH` را با یک سطح `../` اضافه محاسبه می‌کرد و فایل baseline/scan را کاملاً
   بیرون از ریشه ریپازیتوری (در `copilot-worktrees/holand2/docs/...`) می‌نوشت. در حالت CI این
   یعنی baseline هرگز persist نمی‌شد و گیت `i18n:check --fail-on-new` عملاً بی‌اثر بود. رفع شد
   (یک `../` کم شد) و تأیید شد که خروجی داخل `docs/frontend-development/results/` ریپو می‌نشیند.
2. **کوری‌اسکنر نسبت به route pages (رفع‌شده)** — `scan-hardcoded.mjs` فقط
   `app/shared` و `components` را اسکن می‌کرد؛ صفحات واقعی هدف (`app/(hydrogen)/career-guidance/**`)
   اصلاً پیمایش نمی‌شدند. دایرکتوری `app/(hydrogen)/career-guidance` به `SCAN_DIRS` اضافه شد
   (به‌صورت محدود، بدون افزودن ماژول‌های غیرمرتبط قالب مثل chat/projects/one-search).
3. **کوری‌اسکنر نسبت به متن فارسی (رفع‌شده)** — heuristic قبلی فقط رشته‌های JSX را تشخیص
   می‌داد که با حرف بزرگ لاتین شروع شوند (`[A-Z][a-zA-Z]{2,}`)؛ بنابراین کل صفحاتی که تماماً
   متن فارسی hardcoded دارند (بدون هیچ فراخوانی `t()`) نامرئی بودند. یک الگوی دوم برای شروع با
   کاراکتر فارسی/عربی (`[\u0600-\u06FF]`) اضافه شد. نتیجه: شمار heuristic از 629 به 744 رسید
   (که نشان‌دهنده حجم واقعی بدهی i18n بود، نه رگرسیون).

## 2) یافته کلیدی — صفحات هدف release-readiness عملاً i18n ندارند

از 13 فایل `page.tsx` زیر `app/(hydrogen)/career-guidance/**`، فقط **یک فایل**
(`reports/[sessionId]/page.tsx`) از `useTranslation`/`i18n` استفاده می‌کند. باقی صفحات
(assessments, assessments/start, assessments/[sessionId], assessments/[sessionId]/result,
assessments/compare, assessments/history, reports (لیست), counselor, analytics,
career-guidance اصلی) متن‌شان به‌صورت کامل فارسی hardcoded است — یعنی اگر کاربر زبان را به
انگلیسی تغییر دهد، این صفحات همچنان فارسی نمایش داده می‌شوند. این ریشه اصلی BLK-06 است، نه
صرفاً چند رشته پراکنده.

اسکن پس از رفع باگ‌ها **30 مورد متن hardcoded مشخص** در `career-guidance/**` پیدا کرد
(نمونه‌ها: `مرکز آزمون‌ها`, `شروع آزمون جدید`, `در حال بارگذاری مقایسه...`, `RIASEC (هالند)`).
جزئیات کامل در `docs/frontend-development/results/i18n-scan-latest.json`.

## 3) چرا در همین PR صفحات را کامل i18n نکردیم (تصمیم آگاهانه scope)

طبق نگاشت مالکیت در `docs/release-readiness-phased-remediation-plan-fa.md`:
- `reports/[sessionId]/page.tsx` → مالک WS-C (Worker C، در حال اجرا)
- `assessments/history/page.tsx` → مالک WS-D (Worker D، در حال اجرا)
- `expert-lab/page.tsx` → مالک WS-E (Worker E، در حال Plan)

این سه فایل **مستقیماً** توسط Workerهای دیگر در حال توسعه‌اند؛ ویرایش هم‌زمان ریسک conflict/
merge را بالا می‌برد و با اصل «dependency-safe slices» هماهنگ نیست. فایل‌های بدون مالک صریح
(`assessments/page.tsx`, `assessments/start`, `assessments/[sessionId]`, `assessments/compare`,
`reports/page.tsx` لیست، `counselor/page.tsx`, `analytics/page.tsx`, `career-guidance/page.tsx`)
کاندید امن‌تری برای retrofit هستند، اما retrofit صحیح i18n (افزودن کلید در `locales/en.ts` و
`locales/fa.ts` + wiring `useTranslation` + تست دستی جهت‌بندی RTL/LTR) برای ۹ صفحه، حجمی فراتر
از یک "safe slice" یک‌روزه است و باید در یک PR اختصاصی و قابل‌بازبینی جدا انجام شود.

## 4) موارد معلق (Deferred) — نیازمند پیگیری جداگانه

- [ ] Retrofit کامل i18n برای صفحات بدون مالک صریح (لیست بالا) — پیشنهاد: PR مستقل بعدی،
      قبل از Phase 4 final sign-off (DC-06 / G1-3).
- [ ] هماهنگی با Worker C/D/E برای retrofit صفحات تحت مالکیت‌شان — این فاز نباید بدون هماهنگی
      روی آن فایل‌ها دست ببرد.
- [ ] تصمیم‌گیری درباره سرنوشت `locales/fa-clean.ts` و `locales/en-clean.ts` (آیا نسخه در حال
      migration هستند یا کد مرده) — طبق پاسخ coordinator این تصمیم به Worker F واگذار شده، اما
      بررسی محتوایی هنوز انجام نشده و در یک اسلایس بعدی پیگیری می‌شود تا ریسک این PR را پایین
      نگه داریم.
- [ ] `missingInFa` (15 کلید) و `missingInEn` (42 کلید) گزارش‌شده توسط `i18n:check` همگی به
      ماژول‌های خارج از scope این فاز تعلق دارند (`chatPage.*`, `projects.table.*`,
      `pipeline.topology.*`, `searchHub.*`) — هیچ‌کدام در مسیرهای هدف release-readiness نیستند؛
      لذا در این فاز اصلاح نشدند تا از دست‌کاری ماژول‌های خارج از scope اجتناب شود.

## 5) baseline فعلی برای گیت CI آینده

فایل `docs/frontend-development/results/i18n-baseline.json` اکنون به‌درستی در ریپو persist
می‌شود (hardcodedCount=744) و می‌تواند مبنای گیت `pnpm i18n:check --fail-on-new` در CI باشد تا
از این پس رگرسیون جدید مسدود شود، بدون این‌که بدهی موجود را blocking کند.
