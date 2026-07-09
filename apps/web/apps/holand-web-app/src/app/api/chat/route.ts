// ============================================
// POST /api/chat — Server-side proxy to the local LLM (Ollama / OpenAI-compatible).
//
// WHY a server route: the browser cannot reach Ollama at 127.0.0.1:11434 from
// other machines, and CORS would block direct calls anyway. This route runs
// in Node, forwards the body verbatim, and returns the JSON response back.
//
// Configure with environment variables:
//   OLLAMA_URL    (default: http://127.0.0.1:11434/v1/chat/completions)
//   OLLAMA_MODEL  (default: qwen3.5-nothink:latest)
//
// Used by:  src/app/(map)/map-chat/lib/agent.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { getOllamaUrl } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5-nothink:latest';

/**
 * Forward an OpenAI-shaped chat-completions request to the local Ollama server.
 *
 * @endpoint POST /api/chat
 * @param body - OpenAI ChatCompletion request (messages, tools, tool_choice, …)
 * @returns the upstream JSON response untouched
 * @throws {502} when Ollama is unreachable
 */
export async function POST(req: NextRequest) {
  let upstreamUrl: string;
  try {
    upstreamUrl = getOllamaUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'OLLAMA_URL is not configured';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  console.info('[API/chat] Incoming request:', { upstream: upstreamUrl });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Inject the default model if the client did not pin one.
  if (!body.model) body.model = DEFAULT_MODEL;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const text = await upstreamRes.text();
    if (!upstreamRes.ok) {
      console.error('[API/chat] Upstream error:', upstreamRes.status, text.slice(0, 200));
      return new NextResponse(text, {
        status: upstreamRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.info('[API/chat] Upstream OK:', { bytes: text.length });
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/chat] Failed:', msg);
    return NextResponse.json(
      {
        error: 'LLM upstream unreachable',
        detail: msg,
        hint: 'Configure OLLAMA_URL via check-and-run.ps1.',
      },
      { status: 502 }
    );
  }
}
