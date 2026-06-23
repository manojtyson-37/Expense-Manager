import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category } from '../db'

export function useCategories(type?: 'income' | 'expense') {
  return useLiveQuery(async () => {
    if (type) {
      return db.categories.where('type').equals(type).toArray()
    }
    return db.categories.toArray()
  }, [type])
}

export async function addCategory(data: Omit<Category, 'id'>) {
  return db.categories.add(data)
}

export async function deleteCategory(id: number) {
  return db.categories.delete(id)
}
