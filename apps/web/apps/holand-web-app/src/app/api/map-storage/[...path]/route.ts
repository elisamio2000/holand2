// Proxies Storage map tile routes via API Gateway (/storage/map/*).

import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuthToken } from '@/lib/next-auth-token';
import { getGatewayUrl } from '@/lib/service-urls';

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteCtx): Promise<NextResponse> {
  const token = await getRequestAuthToken(request);
  const userId = token?.sub ?? (token as { id?: string } | null)?.id;
  const accessToken =
    typeof token?.accessToken === 'string' ? token.accessToken : undefined;

  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { path } = await context.params;
  if (!path?.length || path[0] !== 'map') {
    return NextResponse.json({ error: 'path must start with map/' }, { status: 400 });
  }

  const subPath = path.join('/');
  const search = request.nextUrl.searchParams.toString();
  const gatewayBase = getGatewayUrl();
  const targetUrl = `${gatewayBase}/storage/${subPath}${search ? `?${search}` : ''}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const groupId = request.headers.get('x-group-id');
  if (groupId) headers['X-Group-Id'] = groupId;
  const range = request.headers.get('range');
  if (range) headers['Range'] = range;
  const accept = request.headers.get('accept');
  if (accept) headers['Accept'] = accept;

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
    const ct = request.headers.get('content-type');
    if (ct) headers['Content-Type'] = ct;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    console.error('[MapStorageProxy] gateway upstream error:', err);
    return NextResponse.json({ error: 'Map storage gateway unreachable' }, { status: 502 });
  }

  const resHeaders = new Headers();
  for (const h of [
    'content-type',
    'content-length',
    'cache-control',
    'etag',
    'last-modified',
    'accept-ranges',
    'content-range',
  ]) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: resHeaders });
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    return NextResponse.json(await upstream.json(), { status: upstream.status, headers: resHeaders });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteCtx) {
  return handle(request, context);
}

export async function HEAD(request: NextRequest, context: RouteCtx) {
  return handle(request, context);
}
