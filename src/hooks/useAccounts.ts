import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Account } from '../db'
import { getUserId } from '../lib/sync'
import { pushAccount, deleteCloudAccount } from '../lib/sync'

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray())
}

export async function addAccount(data: Omit<Account, 'id'>) {
  const id = await db.accounts.add(data)
  const userId = await getUserId()
  if (userId) {
    pushAccount(userId, data).catch(console.error)
  }
  return id
}

export async function updateAccount(id: number, data: Partial<Account>) {
  const old = await db.accounts.get(id)
  await db.accounts.update(id, data)
  const userId = await getUserId()
  if (userId && old) {
    await deleteCloudAccount(userId, old.name)
    const updated = await db.accounts.get(id)
    if (updated) {
      pushAccount(userId, { name: updated.name, type: updated.type, icon: updated.icon, color: updated.color }).catch(console.error)
    }
  }
}

export async function deleteAccount(id: number) {
  const acc = await db.accounts.get(id)
  await db.accounts.delete(id)
  const userId = await getUserId()
  if (userId && acc) {
    deleteCloudAccount(userId, acc.name).catch(console.error)
  }
}
