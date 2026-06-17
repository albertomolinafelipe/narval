import { NextRequest, NextResponse } from "next/server";

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? "http://localhost:8080/api/v1";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const segment = path.join("/");
  const search = req.nextUrl.search;
  const url = `${INTERNAL_API_URL}/${segment}${search}`;

  // Forward headers, passing Authorization and Cookie headers through.
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  
  // Forward cookies from browser to backend
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const resBody = await upstream.arrayBuffer();
  const resHeaders = new Headers();
  const resContentType = upstream.headers.get("content-type");
  if (resContentType) resHeaders.set("content-type", resContentType);
  
  // Forward all Set-Cookie headers from backend to browser
  const setCookieHeaders = upstream.headers.getSetCookie();
  setCookieHeaders.forEach(cookie => {
    resHeaders.append("set-cookie", cookie);
  });
  
  // Forward SuperTokens-specific headers
  const frontToken = upstream.headers.get("front-token");
  if (frontToken) resHeaders.set("front-token", frontToken);
  const accessToken = upstream.headers.get("st-access-token");
  if (accessToken) resHeaders.set("st-access-token", accessToken);
  const refreshToken = upstream.headers.get("st-refresh-token");
  if (refreshToken) resHeaders.set("st-refresh-token", refreshToken);
  const accessControlHeaders = upstream.headers.get("access-control-expose-headers");
  if (accessControlHeaders) resHeaders.set("access-control-expose-headers", accessControlHeaders);

  return new NextResponse(resBody.byteLength > 0 ? resBody : null, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}
