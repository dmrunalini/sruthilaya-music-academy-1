import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { Material } from '../models/material.model';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {

  constructor(private firestore: AngularFirestore) { }

  // User CRUD operations
  createUser(user: User) {
    return this.firestore.collection('users').add(user);
  }

  getUser(userId: string) {
    return this.firestore.collection('users').doc(userId).valueChanges();
  }

  updateUser(userId: string, user: User) {
    return this.firestore.collection('users').doc(userId).update(user);
  }

  deleteUser(userId: string) {
    return this.firestore.collection('users').doc(userId).delete();
  }

  // Class CRUD operations
  createClass(classData: Class) {
    return this.firestore.collection('classes').add(classData);
  }

  getClasses() {
    return this.firestore.collection<Class>('classes').valueChanges();
  }

  getClass(classId: string) {
    return this.firestore.collection('classes').doc(classId).valueChanges();
  }

  updateClass(classId: string, classData: Class) {
    return this.firestore.collection('classes').doc(classId).update(classData);
  }

  deleteClass(classId: string) {
    return this.firestore.collection('classes').doc(classId).delete();
  }

  // Material CRUD operations
  createMaterial(material: Material) {
    return this.firestore.collection('materials').add(material);
  }

  getMaterials() {
    return this.firestore.collection<Material>('materials').valueChanges();
  }

  getMaterial(materialId: string) {
    return this.firestore.collection('materials').doc(materialId).valueChanges();
  }

  updateMaterial(materialId: string, material: Material) {
    return this.firestore.collection('materials').doc(materialId).update(material);
  }

  deleteMaterial(materialId: string) {
    return this.firestore.collection('materials').doc(materialId).delete();
  }
}