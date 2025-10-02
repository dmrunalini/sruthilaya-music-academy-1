import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Class } from '../models/class.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  constructor(private firestore: AngularFirestore) { }

  getClasses(): Observable<Class[]> {
    return this.firestore.collection<Class>('classes').valueChanges();
  }

  addClass(newClass: Class): Promise<void> {
    const id = this.firestore.createId();
    return this.firestore.collection('classes').doc(id).set({ ...newClass, id });
  }

  updateClass(updatedClass: Class): Promise<void> {
    return this.firestore.collection('classes').doc(updatedClass.id).update(updatedClass);
  }

  deleteClass(classId: string): Promise<void> {
    return this.firestore.collection('classes').doc(classId).delete();
  }

  getClassById(classId: string): Observable<Class> {
    return this.firestore.collection<Class>('classes').doc(classId).valueChanges();
  }
}