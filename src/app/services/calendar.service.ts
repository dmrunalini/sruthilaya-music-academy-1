import { Injectable } from '@angular/core';
import { Observable, from, map, firstValueFrom } from 'rxjs';
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

  async addClass(newClass: Class): Promise<any> {
    const res: any = await firstValueFrom(from(this.firestore.createClass(newClass)));
    return res;
  }

  async updateClass(updatedClass: Class): Promise<void> {
    await firstValueFrom(from(this.firestore.updateClass(updatedClass.id!, updatedClass)));
  }

  async deleteClass(classId: string): Promise<void> {
    await firstValueFrom(from(this.firestore.deleteClass(classId)));
  }

  getClassById(classId: string): Observable<Class | undefined> {
    return this.firestore.getClass(classId);
  }
}