import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { Material } from '../models/material.model';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private users = new Map<string, User>();
  private classes = new Map<string, Class>();
  private materials = new Map<string, Material>();

  constructor() { }

  // User CRUD operations (in-memory)
  createUser(user: User) {
    const id = (user.email || 'user') + '_' + Date.now();
    this.users.set(id, { ...user });
    return Promise.resolve({ id });
  }

  getUser(userId: string): Observable<User | undefined> {
    return of(this.users.get(userId));
  }

  updateUser(userId: string, user: User) {
    this.users.set(userId, user);
    return Promise.resolve();
  }

  deleteUser(userId: string) {
    this.users.delete(userId);
    return Promise.resolve();
  }

  // Class CRUD operations (in-memory)
  createClass(classData: Class) {
    const id = 'class_' + Date.now();
    this.classes.set(id, { ...classData, id });
    return Promise.resolve({ id });
  }

  getClasses(): Observable<Class[]> {
    return of(Array.from(this.classes.values()));
  }

  getClass(classId: string): Observable<Class | undefined> {
    return of(this.classes.get(classId));
  }

  updateClass(classId: string, classData: Class) {
    this.classes.set(classId, classData);
    return Promise.resolve();
  }

  deleteClass(classId: string) {
    this.classes.delete(classId);
    return Promise.resolve();
  }

  // Material CRUD operations (in-memory)
  createMaterial(material: Material) {
    const id = 'mat_' + Date.now();
    this.materials.set(id, { ...material, id });
    return Promise.resolve({ id });
  }

  getMaterials(): Observable<Material[]> {
    return of(Array.from(this.materials.values()));
  }

  getMaterial(materialId: string): Observable<Material | undefined> {
    return of(this.materials.get(materialId));
  }

  updateMaterial(materialId: string, material: Material) {
    this.materials.set(materialId, material);
    return Promise.resolve();
  }

  deleteMaterial(materialId: string) {
    this.materials.delete(materialId);
    return Promise.resolve();
  }
}