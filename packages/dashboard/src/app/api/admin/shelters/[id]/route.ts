import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { removeRegistryEntry } from '@/lib/registry';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN ?? 'http://localhost:3000';

function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin') ?? '';
  return origin === ALLOWED_ORIGIN;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { hashedPhone } = await req.json().catch(() => ({ hashedPhone: '' }));
  if (!hashedPhone) {
    return NextResponse.json({ error: 'Missing hashedPhone in body' }, { status: 400 });
  }

  await removeRegistryEntry(params.id, hashedPhone as string);
  return NextResponse.json({ ok: true });
}
