import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category } from '../db'
import { getUserId } from '../lib/sync'
import { pushCategory, deleteCloudCategory } from '../lib/sync'

export function useCategories(type?: 'income' | 'expense') {
  return useLiveQuery(async () => {
    if (type) {
      return db.categories.where('type').equals(type).toArray()
    }
    return db.categories.toArray()
  }, [type])
}

export async function addCategory(data: Omit<Category, 'id'>) {
  const id = await db.categories.add(data)
  const userId = await getUserId()
  if (userId) {
    pushCategory(userId, data).catch(console.error)
  }
  return id
}

export async function deleteCategory(id: number) {
  const cat = await db.categories.get(id)
  await db.categories.delete(id)
  const userId = await getUserId()
  if (userId && cat) {
    deleteCloudCategory(userId, cat.name).catch(console.error)
  }
}
