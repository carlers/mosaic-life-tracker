import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { CategoryDocument } from '../db/schema';

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // FIX 1: Extract userId to safely narrow the type and avoid 'user is possibly null' error
    const userId = user?.$id;
    
    if (!userId) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    let subscription: any;
    
    async function init() {
      try {
        const db = getDatabase();
        const query = db.categories.find({
          selector: {
            userId: userId,
            isDeleted: false,
          },
          sort: [{ order: 'asc' }],
        });

        subscription = query.$.subscribe((docs) => {
          setCategories(docs);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('[useCategories] Error loading categories:', error);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [user?.$id]);

  const addCategory = useCallback(async (cat: Omit<CategoryDocument, 'id' | 'userId' | 'isDeleted'>) => {
    const userId = user?.$id;
    if (!userId) {
      console.error('[useCategories] Cannot add category: User not authenticated');
      return;
    }

    const db = getDatabase();
    
    // FIX 2: Removed createdAt/updatedAt to strictly match the existing CategoryDocument schema
    const newCat: CategoryDocument = {
      ...cat,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      isDeleted: false,
    };

    try {
      await db.categories.insert(newCat);
    } catch (error) {
      console.error('[useCategories] Error inserting category:', error);
    }
  }, [user?.$id]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CategoryDocument>) => {
    const db = getDatabase();
    const doc = await db.categories.findOne(id).exec();
    if (doc) {
      // FIX 3: Removed updatedAt to strictly match the existing CategoryDocument schema
      await doc.patch(updates);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await updateCategory(id, { isDeleted: true });
  }, [updateCategory]);

  const reorderCategories = useCallback(async (newOrder: CategoryDocument[]) => {
    const db = getDatabase();
    const promises = newOrder.map((cat, index) => {
      const doc = db.categories.findOne(cat.id).exec();
      // FIX 4: Removed updatedAt to strictly match the existing CategoryDocument schema
      return doc.then(d => d ? d.patch({ order: index }) : null);
    });
    await Promise.all(promises);
  }, []);

  return { categories, isLoading, addCategory, updateCategory, deleteCategory, reorderCategories };
}