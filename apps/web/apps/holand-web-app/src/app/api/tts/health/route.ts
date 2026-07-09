import { NextResponse } from 'next/server';
import { getTtsBackendUrl } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let backendUrl: string;
  try {
    backendUrl = getTtsBackendUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'TTS_BACKEND_URL is not configured';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  try {
    const direct = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (direct.ok) {
      const data = await direct.json();
      return NextResponse.json(data);
    }

    const viaNext = await fetch(`${backendUrl}/api/tts/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const data = await viaNext.json();
    return NextResponse.json(data, { status: viaNext.status });
  } catch (error: unknown) {
    console.error('[API/tts/health] Backend unreachable:', error);
    return NextResponse.json(
      { ok: false, error: 'backend_unreachable' },
      { status: 502 }
    );
  }
}
