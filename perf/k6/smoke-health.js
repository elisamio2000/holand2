/**
 * k6 load test skeleton — Phase F (Production Hardening / WS-H perf gate).
 *
 * Purpose: read-only, unauthenticated smoke/ramp scenario against public health and
 * monitoring endpoints, ramping toward the 1000-concurrent-user target defined in the
 * release-readiness plan (docs/release-readiness-phased-remediation-plan-fa.md, Phase 4).
 *
 * This is intentionally a SKELETON, not a full perf suite:
 *   - It targets local Docker by default (no staging URL assigned yet — see
 *     docs/qa-gate-matrix-fa.md, G4-perf and the Phase F deferred items list).
 *   - It only exercises endpoints that require no auth (/health, /monitoring/metrics,
 *     /monitoring/readiness) so it is safe to run without seeding test accounts.
 *   - Authenticated, write-heavy scenarios (session start -> answers -> complete ->
 *     report) should be added as a follow-up once a dedicated load-test service
 *     account / staging environment is available (tracked as a deferred item).
 *
 * Usage:
 *   k6 run perf/k6/smoke-health.js
 *   k6 run -e BASE_URL=https://staging.example.com perf/k6/smoke-health.js
 *   k6 run -e TARGET_VUS=1000 -e RAMP_DURATION=5m perf/k6/smoke-health.js
 *
 * CI wiring: intended to run as a non-blocking, manual/nightly job only (see
 * .github/workflows/perf.yml). It must never gate a normal PR merge.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8001';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '1000', 10);
const RAMP_DURATION = __ENV.RAMP_DURATION || '3m';
const HOLD_DURATION = __ENV.HOLD_DURATION || '5m';

export const errorRate = new Rate('holand_error_rate');
export const healthLatency = new Trend('holand_health_latency', true);

export const options = {
  scenarios: {
    ramp_to_target: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: TARGET_VUS },
        { duration: HOLD_DURATION, target: TARGET_VUS },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // SLO placeholders — tune against real staging baselines before treating this as
    // a blocking gate. Documented in docs/qa-gate-matrix-fa.md (G4-perf).
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    holand_error_rate: ['rate<0.01'],
  },
};

export default function () {
  const endpoints = ['/health', '/monitoring/metrics', '/monitoring/readiness'];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: path },
  });

  const ok = check(res, {
    'status is 200 or 503 (readiness can legitimately report no-go)': (r) =>
      r.status === 200 || r.status === 503,
  });

  errorRate.add(!ok);
  healthLatency.add(res.timings.duration);

  sleep(Math.random() * 1 + 0.5);
}
