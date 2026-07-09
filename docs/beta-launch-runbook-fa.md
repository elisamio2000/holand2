# راهنمای لانچ بتا (Phase 10)

این سند چک‌لیست نهایی لانچ بتا، آماده‌سازی تیم، و روند onboarding را پوشش می‌دهد.

## 1) چک‌لیست Go/No-Go قبل از لانچ

- API health: endpointهای `/health` و `/monitoring/metrics` و `/monitoring/readiness` در محیط staging سبز باشند.
- Security baseline: هدرهای امنیتی، trusted hosts، و rate limit فعال باشند.
- Quality monitor: endpoint هشدار `/admin/alerts/recommendation-quality` فعال و قابل دسترس باشد.
- CI status: pipeline اصلی با gateهای `Pytest beta readiness gates` بدون خطای blocking عبور کرده باشد.
- Docs: لینک اسناد محصول/فنی/پشتیبانی در دسترس تیم پشتیبانی باشد.

### تبدیل چک‌لیست به gate اجرایی

1. Runtime gate: `GET /monitoring/readiness`
   - `go_no_go == "go"` فقط در صورتی که همه checkها پاس باشند.
   - checkها:
     - `api_error_5xx_rate`: نرخ 5xx کمتر از `BETA_5XX_ERROR_RATE_THRESHOLD_PERCENT` (پیش‌فرض 1%)
     - `assessment_completion_rate`: نرخ completion بیشتر/مساوی `BETA_COMPLETION_RATE_THRESHOLD_PERCENT` (پیش‌فرض 70%) با حداقل `BETA_COMPLETION_MIN_SESSIONS` نمونه
     - `recommendation_quality_alert`: alert کیفیت توصیه فعال نباشد (`alert_code=RECOMMENDATION_QUALITY_OK`)
     - `operational_environment_validation`: در staging/production کلیدهای حیاتی امن و non-default باشند
2. CI gate: اجرای تست‌های readiness در `.github/workflows/ci.yml`
3. Smoke gate: اجرای دستور زیر روی staging قبل از go-live:
   - `python -m app.scripts.smoke_beta_readiness --base-url https://<staging-api>`

## 2) برنامه رول‌اوت بتا

1. شروع با 5-10% کاربران هدف (cohort محدود).
2. پایش شاخص‌ها در بازه‌های 2 ساعته.
3. اگر error rate یا alert quality از آستانه عبور کرد، rollout را متوقف کنید.
4. در صورت پایداری 24 ساعته، cohort را تا 25% افزایش دهید.

### پیش‌نیاز فنی قرارداد canonical جلسات

- پیش از rollout وب، migration `20260709_03` باید روی دیتابیس production/staging اجرا شده باشد (افزودن پشتیبانی `combined` و فیلدهای pin نسخه ثانویه session).
- بعد از استقرار API، endpointهای canonical مسیر `/sessions/*` باید برای `combined` نیز سالم باشند؛ fallback اختصاصی `combined` در وب بازنشسته شده است.

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
- بررسی `ops.alert` با `alert_code=BETA_READINESS_BLOCKED` برای شناسایی checkهای fail شده
- rollback به نسخه پایدار قبلی در صورت تداوم

### B) افت کیفیت توصیه‌ها
- بررسی alert در `/admin/alerts/recommendation-quality`
- بررسی روند بازخورد در `/admin/recommendation-quality/trends` (به‌ویژه top reasonها)
- تحلیل drift در `/admin/recommendation-quality/drift` برای مقایسه پنجره جاری/قبلی
- بررسی `alert_code`:
  - `RECOMMENDATION_QUALITY_DEGRADED` => کاهش کیفیت تایید شده
  - `RECOMMENDATION_QUALITY_OK` => کیفیت در محدوده قابل قبول
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

## 6) داشبورد/Probe عملیاتی (نقطه مشاهده واحد)

1. Dashboard reliability:
   - منبع completion: `GET /analytics/funnel`
   - منبع error rate: `GET /monitoring/metrics`
   - منبع کیفیت توصیه: `GET /admin/alerts/recommendation-quality`
   - وضعیت نهایی go/no-go: `GET /monitoring/readiness`
2. Probe interval:
   - در 24 ساعت اول لانچ: هر 30 دقیقه
   - بعد از پایداری: هر 2 ساعت
3. Alert surface:
   - Structured logs (`event=ops.alert`)
   - API readiness endpoint (`go_no_go=no-go`)

## 7) مالکیت عملیاتی (Ownership)

| حوزه | مالک اصلی | پشتیبان |
| --- | --- | --- |
| SRE / Incident Command | `BETA_OWNER_SRE` (پیش‌فرض: `sre-oncall`) | backend lead |
| API Reliability / 5xx | `BETA_OWNER_BACKEND` (پیش‌فرض: `backend-oncall`) | SRE on-call |
| Funnel Completion / Product Quality | `BETA_OWNER_PRODUCT` (پیش‌فرض: `product-oncall`) | support lead |
| Recommendation Quality Alert | `BETA_OWNER_BACKEND` | product owner |

## 8) پلی‌بوک اجرایی دقیق لانچ + rollback

1. قبل از لانچ:
   - اجرای CI روی commit نهایی
   - اجرای smoke روی staging
   - بررسی `go_no_go` در `/monitoring/readiness`
2. هنگام لانچ:
   - rollout محدود 5-10%
   - monitor هر 30 دقیقه برای 6 ساعت اول
3. شرط rollback فوری:
   - `go_no_go=no-go` در دو probe متوالی
   - یا `api_error_5xx_rate` fail برای بیش از 15 دقیقه
4. rollback:
   - بازگشت به release پایدار قبلی
   - freeze rollout cohort
   - ثبت incident summary + owner + ETA اصلاح
