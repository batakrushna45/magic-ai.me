import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/lib/db';
import { ReferrerUpdateSchema } from '@/lib/validations';

type ReferrerHistoryRow = {
  referrer_ir_id: string;
  referrer_name: string | null;
  referrer_exists: boolean;
  is_current: boolean;
  created_at: Date | string;
};

// ── GET /api/referrer — current + history ─────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session as any).userId as string;

  const history = await sql`
    SELECT referrer_ir_id, referrer_name, referrer_exists, is_current, created_at
    FROM referrer_mapping
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  ` as ReferrerHistoryRow[];

  return NextResponse.json({
    current: history.find(r => r.is_current) ?? null,
    history: history.filter(r => !r.is_current),
  });
}

// ── PUT /api/referrer — update referrer (archives previous) ───────────────────
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session as any).userId as string;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = ReferrerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { referrer_ir_id } = parsed.data;
  const upper = referrer_ir_id.toUpperCase();

  // Look up the referrer in ir_data
  const irRows = await sql`SELECT name FROM ir_data WHERE ir_id = ${upper}`;
  const referrerExists = irRows.length > 0;
  const referrerName   = referrerExists ? (irRows[0].name as string) : null;

  // Get existing current referrer for audit
  const [oldRef] = await sql`
    SELECT referrer_ir_id FROM referrer_mapping
    WHERE user_id = ${userId} AND is_current = TRUE
  `;

  // Don't allow setting the same referrer
  if (oldRef?.referrer_ir_id === upper) {
    return NextResponse.json(
      { error: 'This is already your current referrer.' },
      { status: 409 }
    );
  }

  // Archive old
  await sql`
    UPDATE referrer_mapping
    SET is_current = FALSE
    WHERE user_id = ${userId} AND is_current = TRUE
  `;

  // Insert new
  await sql`
    INSERT INTO referrer_mapping (user_id, referrer_ir_id, referrer_name, referrer_exists, is_current)
    VALUES (${userId}, ${upper}, ${referrerName}, ${referrerExists}, TRUE)
  `;

  // Audit
  await sql`
    INSERT INTO audit_logs (user_id, action, old_value, new_value, ip_address)
    VALUES (
      ${userId}, 'UPDATE_REFERRER',
      ${JSON.stringify({ referrer_ir_id: oldRef?.referrer_ir_id ?? null })},
      ${JSON.stringify({ referrer_ir_id: upper, referrer_name: referrerName, referrer_exists: referrerExists })},
      ${ip}
    )
  `;

  return NextResponse.json({
    message: referrerExists
      ? `Referrer set to ${referrerName} (${upper}).`
      : `Referrer set to ${upper}. Note: this IR ID was not found in our database, but it has been saved.`,
    referrer: { referrer_ir_id: upper, referrer_name: referrerName, referrer_exists: referrerExists },
  });
}
