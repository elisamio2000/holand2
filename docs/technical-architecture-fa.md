# معماری فنی پیشنهادی

## 1) معماری کلان

- Frontend Web App
- API Gateway / BFF
- Assessment Engine
- Scoring Governance Service
- Recommendation Service
- Analytics Service
- Admin and Counselor Portal

## 2) استک پیشنهادی

- Frontend: Next.js + TypeScript + Tailwind
- Backend: FastAPI + Python
- Database: PostgreSQL
- Cache/Queue: Redis
- Search/Analytics: ClickHouse یا PostgreSQL materialized views در فاز MVP
- Deployment: Docker + CI/CD

## 3) سرویس ها

### 3.1 Identity Service

- ثبت نام، ورود، مدیریت نقش ها (کاربر، مشاور، ادمین)
- JWT + Refresh Token

### 3.2 Assessment Service

- مدیریت بانک سوالات نسخه بندی شده
- ثبت پاسخ ها و مدیریت نشست آزمون
- محاسبه امتیاز زیرمقیاس ها

### 3.3 Scoring Governance Service

- مدیریت نسخه سوال، وزن، فرمول و معادلات
- نگهداری Draft/Review/Publish برای هر نسخه
- اجرای Sandbox برای شبیه سازی خروجی قبل از انتشار
- Impact Analysis روی داده های تاریخی
- ثبت Audit Trail کامل برای تغییرات
- ارائه قابلیت Rollback نسخه منتشرشده

### 3.4 Recommendation Service

- نگاشت کد RIASEC و تیپ MBTI به مسیرهای شغلی/تحصیلی
- امتیاز اعتماد بر اساس کامل بودن داده ها
- توضیح پذیری: دلیل هر پیشنهاد

### 3.5 Reporting Service

- گزارش PDF/HTML
- داشبورد روند تغییرات در بازه زمانی

## 4) مدل امنیتی

- رمزنگاری داده حساس در سطح DB
- Rate limit و bot protection
- Audit log برای تغییرات مدیریتی
- حداقل سطح دسترسی برای هر نقش

نقش های تخصصی پنل تحلیل:

- Analyst: ایجاد/ویرایش Draft
- Reviewer: بازبینی علمی/آماری
- Publisher: انتشار نسخه
- Auditor: مشاهده تاریخچه و گزارش تغییرات

## 5) Observability

- Structured logs
- Error tracking
- Metrics: p95 latency, completion funnels, recommendation CTR

## 6) الگوی نسخه بندی آزمون

هر آزمون باید نسخه داشته باشد تا در تغییر سوالات یا کلید نمره گذاری، نتایج قبلی قابل بازتولید بمانند.

## 7) API های کلیدی پنل نسخه بندی

- POST /admin/assessments/{id}/versions/draft
- POST /admin/versions/{id}/simulate
- POST /admin/versions/{id}/review
- POST /admin/versions/{id}/approve
- POST /admin/versions/{id}/publish
- POST /admin/versions/{id}/rollback
- GET /admin/versions/{id}/diff

## 8) مدل داده تکمیلی برای حاکمیت فرمول

- assessment_versions
- question_versions
- option_weight_versions
- scoring_formula_versions
- version_approvals
- version_audit_logs
- simulation_runs

هر رکورد نسخه باید شامل این فیلدها باشد:

- version
- status
- effective_from
- effective_to
- created_by
- approved_by
- rollback_of (nullable)

## 9) Observability تکمیلی برای کیفیت نمره گذاری

- drift در توزیع نمره ها بین نسخه ها
- درصد تغییر تیپ/کد به ازای انتشار نسخه جدید
- نرخ اعتراض یا بازبینی انسانی پس از انتشار
