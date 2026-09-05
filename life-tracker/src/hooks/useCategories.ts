import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { CategoryDocument } from '../db/schema';

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;
    
    async function init() {
      try {
        const db = getDatabase();
        const query = db.categories.find({
          selector: {
            userId: user?.$id,
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
  }, []);

  const addCategory = useCallback(async (cat: Omit<CategoryDocument, 'id' | 'userId' | 'isDeleted'>) => {
    const db = getDatabase();
    
    const newCat: CategoryDocument = {
      ...cat,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user?.$id || 'guest',
      isDeleted: false,
    };

    await db.categories.insert(newCat);
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<CategoryDocument>) => {
    const db = getDatabase();
    const doc = await db.categories.findOne(id).exec();
    if (doc) {
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
      return doc.then(d => d ? d.patch({ order: index }) : null);
    });
    await Promise.all(promises);
  }, []);

  return { categories, isLoading, addCategory, updateCategory, deleteCategory, reorderCategories };
}