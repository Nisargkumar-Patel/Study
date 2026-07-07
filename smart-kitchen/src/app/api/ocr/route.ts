/**
 * POST /api/ocr  (multipart/form-data, field "receipt")
 *
 * Accept an uploaded receipt, run AWS Textract, map the extracted line items
 * to inventory-ingestion records, and (optionally) upsert them into the
 * Inventory collection.
 *
 * Routing:
 *   - single-page image <= 10 MB  -> synchronous AnalyzeExpense (inline bytes)
 *   - PDF or > 10 MB              -> async StartExpenseAnalysis via the
 *                                    RECEIPTS_S3_BUCKET staging bucket
 *
 * Query flag `?commit=true` performs the inventory upsert; otherwise we return
 * the parsed records for the user to review & confirm first (recommended,
 * since receipt units are ambiguous).
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Inventory } from '@/models';
import { parseReceipt, parseReceiptAsync, toInventoryRecords } from '@/server/textract';

export const runtime = 'nodejs'; // Textract SDK needs the Node runtime
export const maxDuration = 60; // async Textract jobs poll for up to ~50s

const SYNC_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('receipt');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing "receipt" file' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'image/jpeg';
    const isPdf =
      contentType === 'application/pdf' ||
      ('name' in file && String((file as File).name).toLowerCase().endsWith('.pdf'));
    const needsAsync = isPdf || bytes.byteLength > SYNC_MAX_BYTES;

    if (needsAsync && !process.env.RECEIPTS_S3_BUCKET) {
      return NextResponse.json(
        {
          error:
            'This receipt needs the async Textract flow (PDF or over 10 MB). ' +
            'Set RECEIPTS_S3_BUCKET, or upload a single-page image under 10 MB.',
        },
        { status: 413 }
      );
    }

    const extracted = needsAsync
      ? await parseReceiptAsync(bytes, contentType)
      : await parseReceipt(bytes);
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
      mode: needsAsync ? 'async' : 'sync',
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
