import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { firstValueFrom } from 'rxjs';

interface StudentInfo extends User {
  remainingClassesToday: number;
  remainingClassesThisMonth: number;
  feePaymentStatus: 'paid' | 'pending' | 'overdue';
  lastPaymentDate?: Date;
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './students.component.html',
  styleUrls: ['./students.component.scss']
})
export class StudentsComponent implements OnInit {
  students: StudentInfo[] = [];
  allClasses: Class[] = [];
  isTeacher = false;
  loading = true;
  currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  constructor(
    private authService: AuthService,
    private firestoreService: FirestoreService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    
    if (!this.isTeacher) {
      // Redirect non-teachers or handle appropriately
      this.loading = false;
      return;
    }

    this.loadData();
  }

  private async loadData() {
    try {
      // Load users and classes in parallel
      const [users, classes] = await Promise.all([
        firstValueFrom(this.firestoreService.getUsers()),
        firstValueFrom(this.firestoreService.getClasses())
      ]);

      this.allClasses = classes || [];
      
      // Filter to get only students
      const studentUsers = (users || []).filter(user => user.role === 'student');
      
      // Calculate student info
      this.students = studentUsers.map(student => this.calculateStudentInfo(student));
      
      this.loading = false;
    } catch (error) {
      console.error('Error loading student data:', error);
      this.loading = false;
    }
  }

  private calculateStudentInfo(student: User): StudentInfo {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Filter classes for this student
    const studentClasses = this.allClasses.filter(cls => {
      const studentUid = (cls as any).studentUid;
      const studentEmail = ((cls as any).studentEmail || '').trim().toLowerCase();
      const studentName = ((cls.studentName || cls.name) || '').trim().toLowerCase();
      
      if (studentUid) {
        return studentUid === student.uid;
      }
      if (studentEmail && student.email) {
        return studentEmail === student.email.trim().toLowerCase();
      }
      if (studentName && student.name) {
        return studentName === student.name.trim().toLowerCase();
      }
      return false;
    });

    // Count remaining classes today
    const remainingClassesToday = studentClasses.filter(cls => {
      const classDate = new Date(cls.classDate);
      return classDate >= today && 
             classDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }).length;

    // Count remaining classes this month
    const remainingClassesThisMonth = studentClasses.filter(cls => {
      const classDate = new Date(cls.classDate);
      return classDate >= now && classDate <= monthEnd;
    }).length;

    // Mock fee payment status (you would get this from your payment system)
    const feePaymentStatus = this.calculateFeeStatus(student);

    return {
      ...student,
      remainingClassesToday,
      remainingClassesThisMonth,
      feePaymentStatus,
      lastPaymentDate: this.getMockLastPaymentDate(student)
    };
  }

  private calculateFeeStatus(student: User): 'paid' | 'pending' | 'overdue' {
    // Mock implementation - replace with actual payment logic
    const mockStatuses: ('paid' | 'pending' | 'overdue')[] = ['paid', 'pending', 'overdue'];
    const hash = student.uid?.charCodeAt(0) || 0;
    return mockStatuses[hash % 3];
  }

  private getMockLastPaymentDate(student: User): Date | undefined {
    // Mock implementation - replace with actual payment data
    const hash = student.uid?.charCodeAt(0) || 0;
    const daysAgo = hash % 30;
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'pending': return 'status-pending';
      case 'overdue': return 'status-overdue';
      default: return '';
    }
  }

  getPaymentStatusText(status: string): string {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'overdue': return 'Overdue';
      default: return 'Unknown';
    }
  }

  getTotalRemainingClasses(): number {
    return this.students.reduce((total, student) => total + student.remainingClassesThisMonth, 0);
  }

  getPaidStudentsCount(): number {
    return this.students.filter(student => student.feePaymentStatus === 'paid').length;
  }

  getOverdueStudentsCount(): number {
    return this.students.filter(student => student.feePaymentStatus === 'overdue').length;
  }
}