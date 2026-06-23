import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Account } from '../db'

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray())
}

export async function addAccount(data: Omit<Account, 'id'>) {
  return db.accounts.add(data)
}

export async function deleteAccount(id: number) {
  return db.accounts.delete(id)
}
