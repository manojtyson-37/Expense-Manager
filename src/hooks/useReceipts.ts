import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

// Local-only — receipts never sync to Supabase (no storage bucket configured
// for this project), so a photo attached on one device stays on that device.

export function useReceipt(transactionUid: string | undefined) {
  return useLiveQuery(async () => {
    if (!transactionUid) return undefined
    return db.receipts.where('transactionUid').equals(transactionUid).first()
  }, [transactionUid])
}

export async function setReceipt(transactionUid: string, blob: Blob): Promise<void> {
  const existing = await db.receipts.where('transactionUid').equals(transactionUid).first()
  if (existing) {
    await db.receipts.update(existing.id!, { blob, createdAt: Date.now() })
  } else {
    await db.receipts.add({ transactionUid, blob, createdAt: Date.now() })
  }
}

export async function deleteReceipt(transactionUid: string): Promise<void> {
  const existing = await db.receipts.where('transactionUid').equals(transactionUid).first()
  if (existing) await db.receipts.delete(existing.id!)
}
