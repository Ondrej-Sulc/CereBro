import { NextResponse } from 'next/server';
import { withRouteContext } from "@/lib/with-request-context";
import { getAppVersion } from "@/lib/app-version";

export const dynamic = 'force-dynamic';

export const GET = withRouteContext(async () => {
  return NextResponse.json({ version: getAppVersion() });
});
