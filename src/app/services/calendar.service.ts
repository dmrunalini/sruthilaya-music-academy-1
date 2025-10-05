import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirestoreService } from './firestore.service';
import { Class } from '../models/class.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  constructor(private firestore: FirestoreService) { }

  getClasses(): Observable<Class[]> {
    return this.firestore.getClasses();
  }

  addClass(newClass: Class): Promise<void> {
    return this.firestore.createClass(newClass).then(() => undefined);
  }

  updateClass(updatedClass: Class): Promise<void> {
    return this.firestore.updateClass(updatedClass.id!, updatedClass);
  }

  deleteClass(classId: string): Promise<void> {
    return this.firestore.deleteClass(classId);
  }

  getClassById(classId: string): Observable<Class | undefined> {
    return this.firestore.getClass(classId);
  }
}