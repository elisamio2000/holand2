import { NextRequest, NextResponse } from 'next/server';
import { getTtsBackendUrl } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { res, data };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let backendUrl: string;
  try {
    backendUrl = getTtsBackendUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'TTS_BACKEND_URL is not configured';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const directUrl = `${backendUrl}/api/tool/run`;
    const direct = await postJson(directUrl, body);
    if (direct.res.ok) {
      return NextResponse.json(direct.data);
    }

    const proxyUrl = `${backendUrl}/api/tts/run`;
    const viaNext = await postJson(proxyUrl, body);
    return NextResponse.json(viaNext.data, { status: viaNext.res.status });
  } catch (error: unknown) {
    console.error('[API/tts/run] Failed to reach TTS backend:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'backend_unreachable',
        detail: 'TTS backend is unreachable. Configure TTS_BACKEND_URL via check-and-run.ps1.',
      },
      { status: 502 }
    );
  }
}
