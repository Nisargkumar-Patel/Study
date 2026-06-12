/**
 * POST /api/ocr  (multipart/form-data, field "receipt")
 *
 * Accept an uploaded receipt image, run AWS Textract AnalyzeExpense, map the
 * extracted line items to inventory-ingestion records, and (optionally) upsert
 * them into the Inventory collection.
 *
 * Query/body flag `?commit=true` performs the inventory upsert; otherwise we
 * return the parsed records for the user to review & confirm in the UI first
 * (recommended, since receipt units are ambiguous).
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Inventory } from '@/models';
import { parseReceipt, toInventoryRecords } from '@/server/textract';

export const runtime = 'nodejs'; // Textract SDK needs the Node runtime

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('receipt');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing "receipt" file' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await parseReceipt(bytes);
    const records = toInventoryRecords(extracted);

    const commit = req.nextUrl.searchParams.get('commit') === 'true';
    if (commit) {
      await connectDB();
      await Promise.all(
        records.map((r) =>
          Inventory.updateOne(
            { name: r.name },
            {
              $inc: { baseAmount: r.baseAmount },
              $setOnInsert: { baseUnit: r.baseUnit, pantryCategory: 'Other' },
              $set: { lastUpdatedBy: 'ocr', inStock: true },
            },
            { upsert: true }
          )
        )
      );
    }

    return NextResponse.json({
      committed: commit,
      itemCount: records.length,
      records,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OCR failed' },
      { status: 500 }
    );
  }
}
