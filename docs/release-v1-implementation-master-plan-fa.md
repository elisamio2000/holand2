# برنامه اجرایی نسخه ۱ (Release v1) — معماری، فازبندی، و اجرای موازی

آخرین به‌روزرسانی: 2026-07-14  
وضعیت: مبنای رسمی اجرای فازبندی نسخه ۱ (غیر-MVP)

## 1) هدف و دامنه

این سند برنامه عملیاتی برای رساندن پروژه به **نسخه قابل ریلیز (v1)** است؛
با تمرکز بر:

- پایداری end-to-end جریان احراز هویت، آزمون، تحلیل، گزارش و مدیریت
- حاکمیت نسخه‌ای سوال/فرمول/تفسیر
- تحلیل نوجوان‌محور (13-17) برای هدایت تحصیلی
- معماری مقیاس‌پذیر برای حداقل 1000 کاربر همزمان
- عدم وابستگی به سرویس‌های پولی یا ارسال داده به سرویس ثالث

## 2) جمع‌بندی گپ‌های فعلی کد (Audit Snapshot)

بر اساس بازبینی کد backend/frontend و مستندات:

1. RBAC فعلی نقش‌های `user/counselor/admin` را دارد؛ نقش‌های `super_admin` و `analyst` به‌صورت کامل و پویا پیاده‌سازی نشده‌اند.
2. ثبت‌نام فعلی فقط `username/email/password` را می‌گیرد؛ فیلدهای الزامی هویتی (نام/نام خانوادگی/کدملی/موبایل/مرکز) و زیرساخت اعتبارسنجی خارجی وجود ندارد.
3. سشن آزمون داده‌های رفتاری دقیق (رفت‌وبرگشت، dwell time هر سوال، تعداد ویرایش پاسخ، timeline تعامل) را ذخیره نمی‌کند.
4. age-band/branch فعلاً کامل و canonical در backend مدیریت نشده و بخشی از رفتار در frontend نگهداری می‌شود.
5. تحلیل گزارش برای رده‌های سنی و برنچ‌ها به‌صورت policy-driven و قابل پیکربندی کامل نشده است.
6. پنل authoring موجود است ولی برای طراحی حرفه‌ای آزمون/فرمول در سطح فرم‌سازهای پیشرفته و مدیریت fork سنی نیاز به توسعه دارد.
7. قرارداد تحلیل ترکیبی Holland+MBTI پیاده شده ولی لایه ترکیبی/تفکیکی کامل قابل تنظیم و governance آن نیاز به تکمیل دارد.
8. تنظیمات Discovery/Template مدل AI وجود دارد ولی تنظیمات سبک/طول/پرامپت per age-band/branch و تفکیک خروجی hard-card vs narrative کامل نیست.

## 3) اصول حاکم بر اجرای v1

- **Config-first**: هیچ رفتار کلیدی (اعتبارسنجی، AI style, limits, feature toggle) هاردکد نباشد.
- **Versioned-everything**: سوال، گزینه، فرمول، template، policy تحلیل، و نگاشت توصیه نسخه‌دار باشد.
- **Auditability**: هر تغییر مدیریتی و هر محاسبه گزارش قابل ردیابی باشد.
- **Age/Branch aware**: همه جریان‌های آزمون و تحلیل نسبت به 4 رده سنی و 4 برنچ سازگار باشند.
- **Bilingual by design**: i18n سراسری و RTL/LTR بدون استثنا در صفحات/کامپوننت‌ها.
- **Reliability gates**: هیچ فاز بدون گیت‌های check-and-run + تست API/Frontend جلو نرود.

## 4) مدل اجرایی نقش‌ها و دسترسی (RQ-Auth-01)

### نقش‌های هدف

- `super_admin`: دسترسی کامل، مدیریت policy و نقش‌ها
- `admin`: مدیریت عملیات و تنظیمات با محدودیت‌های تعیین‌شده
- `analyst`: مدیریت سوال/فرمول/نسخه‌ها بدون دسترسی تنظیمات بحرانی
- `user`: جریان آزمون و گزارش

### سیاست

- کاربر تازه ثبت‌نام‌شده همیشه `user` است.
- دسترسی‌ها ترکیبی از Role + Permission + Section policy هستند.
- Seed اولیه باید هر 4 نقش را بسازد (idempotent).
- RBAC باید از سطح coarse section به مدل permission-driven قابل تنظیم migrate شود.

## 5) قرارداد داده v1 (خلاصه)

### 5.1 پروفایل کاربر

افزودن فیلدهای الزامی ثبت‌نام:

- `first_name`
- `last_name`
- `national_id`
- `mobile_number`
- `center_name`

به‌همراه:

- `identity_validation_status`
- `identity_validation_source`
- `identity_validation_meta`

### 5.2 تنظیمات global برای صحت‌سنجی

تنظیمات مرکزی:

- `validation.enabled.national_id`
- `validation.enabled.mobile`
- `validation.enabled.full_name`
- `validation.provider.<name>.base_url`
- `validation.provider.<name>.timeout_ms`

در v1 پیش‌فرض خاموش (`false`) اما زیرساخت آماده اتصال.

### 5.3 سشن آزمون و رفتار

افزودن قرارداد رفتار:

- `assessment_run_code` (کد یکتای اجرای آزمون)
- `participant_code` (کد یکتای آزمون‌دهنده)
- `started_at`, `completed_at`, `duration_ms`
- event log:
  - view question
  - select option
  - revise option
  - navigate next/prev
  - dwell time per question
  - revisit count per question

### 5.4 branch سنی آزمون

- هر آزمون دارای `age_branch` در 4 مقدار مصوب است.
- پیش‌فرض: branchهای جدید از نسخه پایه clone می‌شوند.
- publish هر branch مستقل نسخه‌بندی می‌شود.

## 6) طراحی تحلیل و گزارش v1

### 6.1 تحلیل تفکیکی + ترکیبی

- **تفکیکی**: تحلیل مستقل Holland و MBTI
- **ترکیبی**: جمع‌بندی تصمیم‌یار با explainability
- نمایش همزمان هر دو لایه در گزارش

### 6.2 دو لایه خروجی AI

1. **Hard Cards (Structured)**
   - فیلدهای ثابت، قابل مانیتور، همیشه حاضر
2. **Narrative Analysis (Free-form)**
   - متن تفسیر تشریحی با سقف قابل تنظیم

تنظیمات per age-band + branch:

- `model_profile`
- `prompt_template_version`
- `max_output_chars`
- `tone_style`
- `risk_guardrails_level`

### 6.3 نوجوان 13-17 (اولویت)

- تاکید روی هدایت تحصیلی مدرسه/دانشگاه
- لحن غیرقطعی، مسئولانه و actionable
- مسیر اقدام مرحله‌ای 3/6/12 ماهه

## 7) فازبندی رسمی v1

## Phase A — Identity & RBAC Foundation (Severity 1)

- نقش‌های 4گانه + seed + migration
- ثبت‌نام با فیلدهای هویتی الزامی
- policy-based permission mapping
- toggleهای global برای validation provider

**Gate A**:  
جریان register/login/permission برای هر 4 نقش پایدار و قابل تست.

## Phase B — Assessment Runtime Integrity

- کد یکتا برای آزمون/آزمون‌دهنده
- event-sourcing رفتار آزمون‌دهنده
- محاسبه duration و شاخص‌های per-question
- history کاملاً backend-driven

**Gate B**:  
بازپخش کامل timeline آزمون و گزارش رفتاری برای هر session.

## Phase C — Authoring Pro + Age Branching

- ساختار حرفه‌ای تب/صفحه برای طراحی آزمون
- مدیریت 4 branch سنی برای هر آزمون
- workflow کامل Draft/Review/Approve/Publish در branch-level

**Gate C**:  
یک آزمون با 4 branch منتشر و قابل اجرا باشد.

## Phase D — Analysis & Composite Intelligence

- تحلیل تفکیکی/ترکیبی Holland+MBTI
- policy تحلیل static per age-band در v1
- قرارداد آماده برای dynamic page generation در roadmap

**Gate D**:  
گزارش هر branch سنی با UI و محتوا متناسب تولید شود.

## Phase E — AI Layer Governance

- hard-card + narrative split
- تنظیمات Discovery/Prompt/Style/Char-limit per age-band+branch
- fallback سیاست‌مند و audit کامل AI generation

**Gate E**:  
ادمین بتواند بدون تغییر کد، رفتار خروجی AI را برای هر branch تنظیم کند.

## Phase F — Production Hardening

- i18n کامل و حذف hardcoded translation
- RTL/LTR استاندارد در همه layoutها
- بهینه‌سازی عملکرد برای 1000 کاربر همزمان
- تکمیل check-and-run به‌عنوان DevOps Assistant Script

**Gate F**:  
Pass کامل release checklist + عدم وجود blocker بحرانی.

## 8) ماتریس اجرای موازی (Worker Plan)

- **Manager Worker (WM)**: مدیریت dependency، merge window، release gate
- **W1 (Identity/RBAC)**: auth, roles, permissions, registration
- **W2 (Session Runtime)**: sessions, events, history integrity
- **W3 (Authoring/Formula)**: expert-lab, branching, governance
- **W4 (Report/Interpretation)**: layered reports, composite contract
- **W5 (AI Ops)**: provider/template/discovery/prompt governance
- **W6 (Frontend UX/i18n)**: bilingual UX, RTL/LTR, flow polish
- **W7 (Perf/Infra)**: indexing, caching, load-shaping, observability
- **W8 (QA/DevOps)**: test automation, check-and-run gates, rollout runbook

## 9) استراتژی کنترل تداخل توسعه موازی

- Freeze روی قرارداد API در شروع هر فاز
- branch policy: یک workstream = یک شاخه و PR
- schema changes فقط با migration versioned و backward-compatible
- feature flag برای rollout تدریجی
- گزارش روزانه WM: risks, blockers, re-plan

## 10) خروجی‌های الزامی هر فاز

- API Contract Diff
- DB Migration Notes
- Test Evidence (API/Web/Smoke)
- Observability snapshot
- Release/Rollback note

## 11) تصمیم اجرایی

این سند به‌عنوان مرجع اجرای نسخه ۱ مصوب است.  
شروع اجرایی از **Phase A (Identity & RBAC Foundation)** انجام می‌شود و تمام فازها باید با gateهای مشخص‌شده بسته شوند.
