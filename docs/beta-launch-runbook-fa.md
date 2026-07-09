# راهنمای لانچ بتا (Phase 10)

این سند چک‌لیست نهایی لانچ بتا، آماده‌سازی تیم، و روند onboarding را پوشش می‌دهد.

## 1) چک‌لیست Go/No-Go قبل از لانچ

- API health: endpointهای `/health` و `/monitoring/metrics` در محیط staging سبز باشند.
- Security baseline: هدرهای امنیتی، trusted hosts، و rate limit فعال باشند.
- Quality monitor: endpoint هشدار `/admin/alerts/recommendation-quality` فعال و قابل دسترس باشد.
- CI status: pipeline اصلی بدون خطای blocking عبور کرده باشد.
- Docs: لینک اسناد محصول/فنی/پشتیبانی در دسترس تیم پشتیبانی باشد.

## 2) برنامه رول‌اوت بتا

1. شروع با 5-10% کاربران هدف (cohort محدود).
2. پایش شاخص‌ها در بازه‌های 2 ساعته.
3. اگر error rate یا alert quality از آستانه عبور کرد، rollout را متوقف کنید.
4. در صورت پایداری 24 ساعته، cohort را تا 25% افزایش دهید.

## 3) onboarding تیم مشاوره و پشتیبانی

- جلسه 45 دقیقه‌ای معرفی جریان آزمون Holland/MBTI
- مرور داشبورد Expert Lab و نحوه بررسی کیفیت توصیه‌ها
- سناریوهای پاسخ به تیکت‌های پرتکرار:
  - نتیجه نامطمئن
  - درخواست بازتفسیر
  - گزارش باگ در توصیه‌ها

### onboarding flow notes (گام‌به‌گام)

1. دسترسی تیم: ایجاد اکانت staging و تخصیص نقش پشتیبانی/مشاوره.
2. سناریوی Happy Path: اجرای کامل flow آزمون تا دریافت توصیه و ثبت feedback.
3. سناریوی Escalation: تمرین مسیر گزارش کیفیت پایین و پیگیری alert ادمین.
4. آماده‌سازی پاسخ‌های استاندارد: FAQ کوتاه برای 10 سوال پرتکرار.
5. مالکیت شیفت لانچ: تعیین on-call محصول، فنی، و پشتیبانی برای 72 ساعت اول.

## 4) runbook رخداد (incident runbook)

### A) افزایش خطای API
- بررسی `/monitoring/metrics` و logهای structured
- rollback به نسخه پایدار قبلی در صورت تداوم

### B) افت کیفیت توصیه‌ها
- بررسی alert در `/admin/alerts/recommendation-quality`
- بررسی روند بازخورد در `/admin/recommendation-quality/trends` (به‌ویژه top reasonها)
- تحلیل drift در `/admin/recommendation-quality/drift` برای مقایسه پنجره جاری/قبلی
- قرنطینه cohort جدید و بازبینی rule/weights

## 4.1) cadence بازبینی کیفیت توصیه (Recommendation Quality Review)

1. بازبینی روزانه (عملیاتی): بررسی alert، drift هفت‌روزه، و reason taxonomy پرتکرار.
2. بازبینی هفتگی (محصول/داده): تحلیل trend 14-30 روزه، نرخ helpful/unhelpful، و اثر تغییرات ranking heuristic.
3. بازبینی ماهانه (حاکمیتی): بازنگری آستانه‌های alert، taxonomy دلیل‌ها، و تصمیم rollout/rollback ruleهای توصیه.

### C) ریزش شدید در funnel
- تحلیل endpoint `/analytics/funnel`
- اصلاح پیام/UX مرحله‌ای و انتشار hotfix

## 5) شاخص‌های موفقیت بتا

- نرخ تکمیل آزمون (completion) ≥ 70%
- low-quality feedback ratio < 35%
- error response rate (5xx) < 1%
- رضایت کاربر (rating 4-5) ≥ 60%
