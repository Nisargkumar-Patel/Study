/**
 * textract.ts — AWS Textract OCR receipt handler logic.
 *
 * Two paths, sharing one extraction mapper:
 *
 *  SYNC  (parseReceipt): single-page JPEG/PNG up to 10 MB — `AnalyzeExpense`
 *        with inline bytes. Fast, no infrastructure beyond IAM.
 *
 *  ASYNC (parseReceiptAsync): multi-page PDFs / large scans — the image is
 *        staged to the RECEIPTS_S3_BUCKET, `StartExpenseAnalysis` kicks off an
 *        async job, and we poll `GetExpenseAnalysis` (paginating NextToken)
 *        until it succeeds. Requires the bucket env var + s3:PutObject and
 *        textract:StartExpenseAnalysis/GetExpenseAnalysis IAM permissions.
 *
 * AnalyzeExpense returns structured ExpenseDocument > LineItemGroups, which is
 * far more reliable for receipts than raw DetectDocumentText.
 */
import {
  AnalyzeExpenseCommand,
  StartExpenseAnalysisCommand,
  GetExpenseAnalysisCommand,
  type ExpenseDocument,
} from '@aws-sdk/client-textract';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getTextractClient, getS3Client } from '@/lib/aws';

export interface ExtractedReceiptItem {
  name: string;
  quantity: number | null;
  price: number | null;
  raw: string;
}

/** Shared mapper: Textract ExpenseDocuments -> line items. */
function extractItems(docs: ExpenseDocument[]): ExtractedReceiptItem[] {
  const items: ExtractedReceiptItem[] = [];

  for (const doc of docs) {
    for (const group of doc.LineItemGroups ?? []) {
      for (const lineItem of group.LineItems ?? []) {
        let name = '';
        let quantity: number | null = null;
        let price: number | null = null;
        const rawParts: string[] = [];

        for (const field of lineItem.LineItemExpenseFields ?? []) {
          const type = field.Type?.Text;
          const value = field.ValueDetection?.Text ?? '';
          rawParts.push(value);

          if (type === 'ITEM' || type === 'PRODUCT_CODE') {
            if (!name) name = value;
          } else if (type === 'QUANTITY') {
            const q = parseFloat(value.replace(/[^0-9.]/g, ''));
            if (!Number.isNaN(q)) quantity = q;
          } else if (type === 'PRICE' || type === 'UNIT_PRICE') {
            const p = parseFloat(value.replace(/[^0-9.]/g, ''));
            if (!Number.isNaN(p)) price = p;
          }
        }

        if (name) {
          items.push({ name: name.trim(), quantity, price, raw: rawParts.join(' | ') });
        }
      }
    }
  }

  return items;
}

/**
 * Synchronous path: parse a single-page receipt image (<= 10 MB).
 */
export async function parseReceipt(imageBytes: Uint8Array): Promise<ExtractedReceiptItem[]> {
  const client = getTextractClient();
  const res = await client.send(
    new AnalyzeExpenseCommand({ Document: { Bytes: imageBytes } })
  );
  return extractItems(res.ExpenseDocuments ?? []);
}

/**
 * Asynchronous path: stage to S3 and run an async expense-analysis job.
 * Handles multi-page PDFs and files beyond the 10 MB synchronous limit.
 *
 * @param bytes        raw file bytes
 * @param contentType  MIME type (image/jpeg, image/png, application/pdf)
 * @param timeoutMs    max time to poll before giving up (job keeps running in
 *                     AWS; the returned error includes the JobId for retry)
 */
export async function parseReceiptAsync(
  bytes: Uint8Array,
  contentType: string,
  timeoutMs = 50_000
): Promise<ExtractedReceiptItem[]> {
  const bucket = process.env.RECEIPTS_S3_BUCKET;
  if (!bucket) {
    throw new Error(
      'RECEIPTS_S3_BUCKET is not configured — multi-page/large receipts need the async Textract flow.'
    );
  }

  const s3 = getS3Client();
  const textract = getTextractClient();
  const key = `receipts/${crypto.randomUUID()}`;

  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType })
  );

  const started = await textract.send(
    new StartExpenseAnalysisCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
    })
  );
  const jobId = started.JobId;
  if (!jobId) throw new Error('Textract did not return a JobId');

  const deadline = Date.now() + timeoutMs;
  const POLL_MS = 2500;

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(
        `Textract job ${jobId} still running after ${timeoutMs / 1000}s — retry shortly.`
      );
    }
    await new Promise((r) => setTimeout(r, POLL_MS));

    const page = await textract.send(new GetExpenseAnalysisCommand({ JobId: jobId }));
    if (page.JobStatus === 'FAILED') {
      throw new Error(`Textract job ${jobId} failed: ${page.StatusMessage || 'unknown error'}`);
    }
    if (page.JobStatus !== 'SUCCEEDED') continue; // IN_PROGRESS

    // Collect every result page (NextToken pagination).
    const docs: ExpenseDocument[] = [...(page.ExpenseDocuments ?? [])];
    let next = page.NextToken;
    while (next) {
      const more = await textract.send(
        new GetExpenseAnalysisCommand({ JobId: jobId, NextToken: next })
      );
      docs.push(...(more.ExpenseDocuments ?? []));
      next = more.NextToken;
    }
    return extractItems(docs);
  }
}

/**
 * Map raw OCR items to inventory-ingestion records. Quantities from receipts
 * are ambiguous (could be count or weight), so we conservatively default to
 * `pcs` and flag every row for human review in the UI.
 */
export interface InventoryIngestRecord {
  name: string;
  baseAmount: number;
  baseUnit: 'g' | 'ml' | 'pcs';
  needsReview: boolean;
}

export function toInventoryRecords(items: ExtractedReceiptItem[]): InventoryIngestRecord[] {
  return items.map((it) => ({
    name: it.name,
    baseAmount: it.quantity ?? 1,
    baseUnit: 'pcs',
    needsReview: true,
  }));
}
