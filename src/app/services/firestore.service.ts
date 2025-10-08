import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { Material } from '../models/material.model';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor() {}

  // Users
  async createUser(user: User) {
    const ref = await addDoc(collection(db, 'users'), user as any);
    return { id: ref.id };
  }

  // Create a user document with a specified uid (useful when syncing with Auth uid)
  async createUserWithId(uid: string, user: User) {
    await setDoc(doc(db, 'users', uid), user as any);
    return { id: uid };
  }

  getUser(userId: string): Observable<User | undefined> {
    // Real-time user document stream so profile (e.g. timezone) changes propagate instantly
    return new Observable<User | undefined>(subscriber => {
      const ref = doc(db, 'users', userId);
      const unsub = onSnapshot(ref, snap => {
        if (snap.exists()) {
          const data = snap.data() as User;
            // attach uid for convenience
          subscriber.next({ uid: snap.id, ...data });
        } else {
          subscriber.next(undefined);
        }
      }, err => subscriber.error(err));
      return () => unsub();
    });
  }

  getUsers(): Observable<User[]> {
    // real-time users stream
    return new Observable<User[]>(subscriber => {
      const q = query(collection(db, 'users'), orderBy('name'));
      const unsub = onSnapshot(q, snap => {
        const users = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as User));
        subscriber.next(users);
      }, err => subscriber.error(err));
      return () => unsub();
    });
  }

  updateUser(userId: string, user: User) {
    return from(updateDoc(doc(db, 'users', userId), user as any));
  }

  deleteUser(userId: string) {
    return from(deleteDoc(doc(db, 'users', userId)));
  }

  // Classes
  async createClass(classData: Class) {
    const ref = await addDoc(collection(db, 'classes'), classData as any);
    return { id: ref.id };
  }

  getClasses(): Observable<Class[]> {
    // real-time classes stream
    return new Observable<Class[]>(subscriber => {
      const q = query(collection(db, 'classes'), orderBy('classDate'));
      const unsub = onSnapshot(q, snap => {
        const classes = snap.docs.map(d => {
          const raw = d.data() as any;
          // normalize classDate to JS Date when Firestore returns a Timestamp
          if (raw && raw.classDate && typeof raw.classDate.toDate === 'function') {
            raw.classDate = raw.classDate.toDate();
          } else if (raw && raw.classDate) {
            raw.classDate = new Date(raw.classDate);
          }
          return ({ id: d.id, ...raw } as Class);
        });
        subscriber.next(classes);
      }, err => subscriber.error(err));
      return () => unsub();
    });
  }

  getClass(classId: string): Observable<Class | undefined> {
    return from(getDoc(doc(db, 'classes', classId)).then(s => s.exists() ? (s.data() as Class) : undefined));
  }

  updateClass(classId: string, classData: Class) {
    return from(updateDoc(doc(db, 'classes', classId), classData as any));
  }

  deleteClass(classId: string) {
    return from(deleteDoc(doc(db, 'classes', classId)));
  }

  // Materials
  async createMaterial(material: Material) {
    const ref = await addDoc(collection(db, 'materials'), material as any);
    return { id: ref.id };
  }

  getMaterials(): Observable<Material[]> {
    return from(getDocs(collection(db, 'materials')).then(snap => snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Material))));
  }

  getMaterial(materialId: string): Observable<Material | undefined> {
    return from(getDoc(doc(db, 'materials', materialId)).then(s => s.exists() ? (s.data() as Material) : undefined));
  }

  updateMaterial(materialId: string, material: Material) {
    return from(updateDoc(doc(db, 'materials', materialId), material as any));
  }

  deleteMaterial(materialId: string) {
    return from(deleteDoc(doc(db, 'materials', materialId)));
  }
}