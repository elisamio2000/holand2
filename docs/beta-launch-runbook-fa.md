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

## 4) runbook رخداد (incident runbook)

### A) افزایش خطای API
- بررسی `/monitoring/metrics` و logهای structured
- rollback به نسخه پایدار قبلی در صورت تداوم

### B) افت کیفیت توصیه‌ها
- بررسی alert در `/admin/alerts/recommendation-quality`
- قرنطینه cohort جدید و بازبینی rule/weights

### C) ریزش شدید در funnel
- تحلیل endpoint `/analytics/funnel`
- اصلاح پیام/UX مرحله‌ای و انتشار hotfix

## 5) شاخص‌های موفقیت بتا

- نرخ تکمیل آزمون (completion) ≥ 70%
- low-quality feedback ratio < 35%
- error response rate (5xx) < 1%
- رضایت کاربر (rating 4-5) ≥ 60%
