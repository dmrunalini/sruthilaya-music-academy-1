import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  isSubmitting = false;
  @ViewChild('newClassInput', { static: false }) newClassInput?: ElementRef<HTMLInputElement>;

  constructor(private firestoreService: FirestoreService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadClasses();
    const user = this.authService.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    // react to auth/profile changes
    this.authService.user$.subscribe(u => {
      this.isTeacher = !!(u && u.role === 'teacher');
    });
  }

  loadClasses(): void {
    this.firestoreService.getClasses().subscribe((data: Class[]) => {
      // normalize and sort classes by earliest classDate first
      this.classes = (data || []).map(c => ({ ...c, classDate: c.classDate ? new Date(c.classDate as any) : new Date(0) } as Class)).sort((a, b) => {
        const da = new Date(a.classDate).getTime();
        const db = new Date(b.classDate).getTime();
        return da - db;
      });
    });
  }

  async addClass() {
    console.log('addClass clicked', { isTeacher: this.isTeacher, newClassName: this.newClassName });
    if (!this.isTeacher) {
      console.warn('addClass: current user is not a teacher');
      return;
    }
    // Fallback: if ngModel didn't populate, read value from input element
    if ((!this.newClassName || this.newClassName.trim().length === 0) && this.newClassInput) {
      const val = this.newClassInput.nativeElement.value;
      console.log('addClass: read fallback value from input', val);
      this.newClassName = val || '';
    }
    if (!this.newClassName || this.newClassName.trim().length === 0) {
      console.warn('addClass: newClassName is empty');
      return;
    }
    const user = this.authService.getUserData();
    this.isSubmitting = true;
    const classData: Partial<Class> = {
      studentName: '',
      name: this.newClassName as any,
      subject: '',
      timeSlot: '',
      teacherId: user?.uid || '',
      classDate: new Date()
    } as any;
    try {
      console.log('addClass: creating class', classData);
      const res = await this.firestoreService.createClass(classData as any);
      console.log('Created class', res);
      this.newClassName = '';
      this.loadClasses();
    } catch (err) {
      console.error('Error creating class', err);
    }
    this.isSubmitting = false;
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