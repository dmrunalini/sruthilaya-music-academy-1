import { Injectable } from '@angular/core';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, setDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { Material } from '../models/material.model';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  constructor() {}

  // categories are just distinct category strings used by materials
  getCategories(): Observable<string[]> {
    return new Observable<string[]>(subscriber => {
      const q = query(collection(db, 'materials'), orderBy('category'));
      const unsub = onSnapshot(q, snap => {
        const cats = Array.from(new Set(snap.docs.map(d => (d.data() as any).category).filter(Boolean)));
        subscriber.next(cats as string[]);
      }, err => subscriber.error(err));
      return () => unsub();
    });
  }

  // real-time materials by category
  getMaterialsByCategory(category?: string): Observable<Material[]> {
    return new Observable<Material[]>(subscriber => {
      const col = collection(db, 'materials');
      const q = category ? query(col, where('category', '==', category), orderBy('createdAt', 'desc')) : query(col, orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Material));
        subscriber.next(items);
      }, err => subscriber.error(err));
      return () => unsub();
    });
  }

  async createMaterial(m: Partial<Material>) {
    const ref = await addDoc(collection(db, 'materials'), m as any);
    return { id: ref.id };
  }

  // create category is a no-op (categories derived from materials) but we provide a helper to create an empty material placeholder
  async createCategory(name: string, ownerUid?: string) {
    const placeholder = {
      title: `__category__${name}`,
      category: name,
      content: '',
      ownerUid: ownerUid || null,
      createdAt: new Date()
    } as any;
    const res = await addDoc(collection(db, 'materials'), placeholder);
    return { id: res.id };
  }

  async updateMaterial(id: string, data: Partial<Material>) {
    const d = doc(db, 'materials', id);
    await updateDoc(d, data as any);
    return { id };
  }

  async deleteMaterial(id: string) {
    const d = doc(db, 'materials', id);
    await deleteDoc(d);
    return { id };
  }
}
