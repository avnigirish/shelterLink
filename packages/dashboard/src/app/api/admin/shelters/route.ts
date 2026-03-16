import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addRegistryEntry } from '@/lib/registry';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN ?? 'http://localhost:3000';

function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin') ?? '';
  return origin === ALLOWED_ORIGIN;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.shelterId || !body?.name || !body?.phone) {
    return NextResponse.json({ error: 'Missing required fields: shelterId, name, phone' }, { status: 400 });
  }

  try {
    await addRegistryEntry(body.shelterId as string, body.name as string, body.phone as string);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add shelter' }, { status: 500 });
  }
}
