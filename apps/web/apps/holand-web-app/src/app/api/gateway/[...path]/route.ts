// ============================================
// Gateway Service Proxy API Route
// Forwards requests to the API Gateway (configured via API_GATEWAY_URL env var)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { gatewayLogger } from '@/lib/server-logger';

const GATEWAY_URL =
  process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';

declare global {
  // eslint-disable-next-line no-var
  var __gatewayConfigLogged: boolean | undefined;
}

if (!global.__gatewayConfigLogged) {
  if (GATEWAY_URL) {
    gatewayLogger.debug('Gateway proxy configured', { target: GATEWAY_URL });
  } else {
    gatewayLogger.warn('Gateway proxy missing API_GATEWAY_URL');
  }
  global.__gatewayConfigLogged = true;
}

async function proxyHandler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!GATEWAY_URL) {
    gatewayLogger.error('Gateway proxy rejected request: API_GATEWAY_URL is not set');
    return NextResponse.json(
      { error: 'API gateway URL is not configured (API_GATEWAY_URL)' },
      { status: 500 }
    );
  }

  const started = Date.now();
  const params = await context.params;

  let path = params.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const gatewayBase = GATEWAY_URL.replace(/\/$/, '');
  if (/\/api\/v1$/i.test(gatewayBase) && path.startsWith('api/v1/')) {
    path = path.slice('api/v1/'.length);
  }
  const targetUrl = `${gatewayBase}/${path}${searchParams ? `?${searchParams}` : ''}`;
  const proxyPath = `/api/gateway/${path}`;

  try {
    const incomingContentType = request.headers.get('content-type') || '';
    const isMultipart = incomingContentType.includes('multipart/form-data');

    const headers = new Headers();
    const headersToForward = [
      'authorization',
      ...(isMultipart ? [] : ['content-type']),
      'accept',
      'accept-language',
      'if-none-match',
      'if-modified-since',
      'range',
      'x-requested-with',
      'x-group-id',
      'x-user-id',
      'x-is-admin',
      'Upload-Offset',
      'Upload-Length',
    ];

    for (const header of headersToForward) {
      const value = request.headers.get(header);
      if (value) headers.set(header, value);
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (incomingContentType.includes('application/json')) {
        fetchOptions.body = JSON.stringify(await request.json());
      } else if (isMultipart) {
        fetchOptions.body = await request.formData();
      } else if (
        incomingContentType.includes('application/octet-stream') ||
        incomingContentType.includes('application/offset+octet-stream')
      ) {
        const arrayBuffer = await request.arrayBuffer();
        fetchOptions.body = Buffer.from(arrayBuffer);
      } else {
        fetchOptions.body = await request.text();
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const durationMs = Date.now() - started;

    gatewayLogger.http({
      component: 'gateway',
      method: request.method,
      path: proxyPath,
      status: response.status,
      durationMs,
    });

    const responseHeaders = new Headers();
    const skipHeaders = ['transfer-encoding', 'connection', 'keep-alive'];
    response.headers.forEach((value, key) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const responseContentType = response.headers.get('content-type') || '';
    if (responseContentType.includes('text/event-stream') && response.body) {
      gatewayLogger.debug('Gateway SSE stream started', { path: proxyPath });
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const nullBodyStatuses = [204, 205, 304];
    if (nullBodyStatuses.includes(response.status)) {
      return new NextResponse(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);

    gatewayLogger.http({
      component: 'gateway',
      method: request.method,
      path: proxyPath,
      status: 502,
      durationMs,
      detail: message,
    });
    gatewayLogger.error('Gateway proxy upstream failure', {
      path: proxyPath,
      target: targetUrl,
      error: message,
    });

    return NextResponse.json(
      { error: 'Proxy error', details: message },
      { status: 502 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const HEAD = proxyHandler;
