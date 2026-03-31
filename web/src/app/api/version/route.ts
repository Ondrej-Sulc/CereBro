import { NextResponse } from 'next/server';
import { withRouteContext } from "@/lib/with-request-context";

export const dynamic = 'force-dynamic';

export const GET = withRouteContext(async (req) => {
  return NextResponse.json({ version: process.env.APP_VERSION });
});
