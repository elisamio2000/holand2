// ============================================
// Plugin Executor Proxy — /api/plugins/executor/[...path]
// Browser calls same-origin proxy; server forwards to PLUGIN_EXECUTOR_URL.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getPluginExecutorUrl } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

async function proxyHandler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  let executorBase: string;
  try {
    executorBase = getPluginExecutorUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'PLUGIN_EXECUTOR_URL is not configured';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const params = await context.params;
  const path = params.path.join('/');
  const search = request.nextUrl.searchParams.toString();
  const targetUrl = `${executorBase}/${path}${search ? `?${search}` : ''}`;

  const incomingContentType = request.headers.get('content-type') || '';
  const isMultipart = incomingContentType.includes('multipart/form-data');

  const headers = new Headers();
  const headersToForward = [
    'authorization',
    ...(isMultipart ? [] : ['content-type']),
    'accept',
  ];
  for (const header of headersToForward) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }

  const fetchOptions: RequestInit = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (incomingContentType.includes('application/json')) {
      fetchOptions.body = JSON.stringify(await request.json());
    } else if (isMultipart) {
      fetchOptions.body = await request.formData();
    } else {
      fetchOptions.body = await request.text();
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    const responseContentType = response.headers.get('content-type') || '';
    if (responseContentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: response.status,
      headers: { 'content-type': responseContentType || 'application/octet-stream' },
    });
  } catch (error: unknown) {
    console.error('[PluginExecutorProxy] Unreachable:', { targetUrl, error });
    return NextResponse.json(
      { error: 'Plugin Executor unreachable. Configure PLUGIN_EXECUTOR_URL via check-and-run.ps1.' },
      { status: 503 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const DELETE = proxyHandler;
export const PATCH = proxyHandler;
