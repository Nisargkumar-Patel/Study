/**
 * textract.ts — AWS Textract OCR receipt handler logic.
 *
 * Flow for a grocery receipt photo:
 *   1. Receive raw image bytes from the upload route.
 *   2. Run synchronous `AnalyzeExpense` (purpose-built for receipts/invoices)
 *      to pull line items + quantities + prices.
 *   3. Map each extracted line into a normalized inventory ingestion record.
 *   4. The route layer upserts those records into the Inventory collection.
 *
 * AnalyzeExpense returns structured ExpenseDocument > LineItemGroups, which is
 * far more reliable for receipts than raw DetectDocumentText.
 */
import { AnalyzeExpenseCommand } from '@aws-sdk/client-textract';
import { getTextractClient } from '@/lib/aws';

export interface ExtractedReceiptItem {
  name: string;
  quantity: number | null;
  price: number | null;
  raw: string;
}

/**
 * Parse a receipt image with Textract AnalyzeExpense.
 * @param imageBytes raw bytes of a JPEG/PNG (synchronous API: <= 10 MB / <= 1 page)
 */
export async function parseReceipt(imageBytes: Uint8Array): Promise<ExtractedReceiptItem[]> {
  const client = getTextractClient();
  const res = await client.send(
    new AnalyzeExpenseCommand({ Document: { Bytes: imageBytes } })
  );

  const items: ExtractedReceiptItem[] = [];

  for (const doc of res.ExpenseDocuments ?? []) {
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
 * Map raw OCR items to inventory-ingestion records. Quantities from receipts are
 * ambiguous (could be count or weight), so we conservatively default to `pcs`
 * and flag low-confidence rows for human review in the UI.
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
    // Receipts rarely give clean units, so always surface for confirmation.
    needsReview: true,
  }));
}
