import { Component, OnInit } from '@angular/core';
import { FirestoreService } from '../../services/firestore.service';
import { Class } from '../../models/class.model';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-class-list',
  templateUrl: './class-list.component.html',
  styleUrls: ['./class-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ClassListComponent implements OnInit {
  classes: Class[] = [];
  isTeacher = false;
  newClassName = '';

  constructor(private firestoreService: FirestoreService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadClasses();
    const user = this.authService.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
  }

  loadClasses(): void {
    this.firestoreService.getClasses().subscribe((data: Class[]) => {
      this.classes = data;
    });
  }

  async addClass() {
    if (!this.isTeacher || !this.newClassName) return;
    const user = this.authService.getUserData();
    const classData: Partial<Class> = {
      studentName: '',
      name: this.newClassName as any,
      subject: '',
      timeSlot: '',
      teacherId: user?.uid || '',
      classDate: new Date()
    } as any;
    try {
      const res = await this.firestoreService.createClass(classData as any);
      console.log('Created class', res);
      this.newClassName = '';
      this.loadClasses();
    } catch (err) {
      console.error('Error creating class', err);
    }
  }

  async removeClass(classId: string) {
    if (!this.isTeacher) return;
    try {
      await this.firestoreService.deleteClass(classId);
      this.loadClasses();
    } catch (err) {
      console.error('Error deleting class', err);
    }
  }
}