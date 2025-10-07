import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FirestoreService } from '../../services/firestore.service';
import { Class } from '../../models/class.model';
import { AuthService } from '../../services/auth.service';
import { auth } from '../../firebase';
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
  currentUserName: string | null = null;

  get displayName(): string | null {
    if (this.currentUserName) return this.currentUserName;
    const ud = this.authService.getUserData();
    if (ud && ud.name) return ud.name;
    // fallback to auth currentUser displayName or email
    const a = auth.currentUser as any;
    if (a) return a.displayName || a.email || null;
    return null;
  }

  // week navigation for class list
  days: Date[] = [];
  currentWeekOffset = 0;
  minWeekOffset = -26; // ~6 months back
  maxWeekOffset = 26; // ~6 months forward
  visibleClasses: Class[] = [];

  constructor(private firestoreService: FirestoreService, private authService: AuthService) {}

  ngOnInit(): void {
    // Always initialize the week view so the header shows even before auth state resolves
    this.setWeekOffset(0);
    // Guard should redirect unauthenticated users, but avoid starting Firestore subscriptions unless logged in
    if (this.authService.isLoggedIn()) {
      this.loadClasses();
    }
    const user = this.authService.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    this.currentUserName = user?.name || null;
    // react to auth/profile changes
    this.authService.user$.subscribe(u => {
      this.isTeacher = !!(u && u.role === 'teacher');
      // when a user logs in, if they are authenticated, load classes
      if (u) {
        this.loadClasses();
      }
      // re-filter visible classes when the auth/profile changes (important for students)
      this.filterVisibleClasses();
      this.currentUserName = u?.name || null;
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
      this.filterVisibleClasses();
    });
  }

  private startOfWeekDate(base: Date) {
    const d = new Date(base);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diff = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  setWeekOffset(offset: number) {
    if (offset < this.minWeekOffset) offset = this.minWeekOffset;
    if (offset > this.maxWeekOffset) offset = this.maxWeekOffset;
    this.currentWeekOffset = offset;
    const base = new Date();
    base.setDate(base.getDate() + offset * 7);
    this.days = [];
    const sow = this.startOfWeekDate(base);
    for (let i = 0; i < 7; i++) {
      const d = new Date(sow);
      d.setDate(sow.getDate() + i);
      this.days.push(d);
    }
  }

  prevWeek() {
    this.setWeekOffset(this.currentWeekOffset - 1);
    this.filterVisibleClasses();
  }

  nextWeek() {
    this.setWeekOffset(this.currentWeekOffset + 1);
    this.filterVisibleClasses();
  }

  filterVisibleClasses() {
    if (!this.classes) {
      this.visibleClasses = [];
      return;
    }
    const start = this.days[0];
    const end = new Date(this.days[6]);
    end.setHours(23, 59, 59, 999);
    // base week filter
    let list = this.classes.filter(c => {
      const d = new Date(c.classDate);
      return d >= start && d <= end;
    });

    // if the current user is a student, show only their classes
    const currentUser = this.authService.getUserData();
    if (currentUser && currentUser.role === 'student') {
      const uname = (currentUser.name || '').trim().toLowerCase();
      const uid = currentUser.uid || '';
      const uemail = (currentUser.email || '').trim().toLowerCase();
      list = list.filter(c => {
        // prefer an explicit studentUid field if present
        const studentUid = (c as any).studentUid as string | undefined;
        const studentEmail = ((c as any).studentEmail || '').trim().toLowerCase();
        const studentName = ((c.studentName || c.name) || '').trim().toLowerCase();
        if (studentUid) {
          return studentUid === uid;
        }
        // fallback: match by email if available, otherwise by name (case-insensitive)
        if (studentEmail && uemail) {
          return studentEmail === uemail;
        }
        if (studentName && uname) {
          return studentName === uname;
        }
        return false;
      });
    }

    this.visibleClasses = list;
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