import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { TimezoneService } from '../services/timezone.service';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { firstValueFrom } from 'rxjs';

interface StudentInfo extends User {
  remainingClassesThisMonth: number;
  feePaymentStatus: 'paid' | 'pending' | 'overdue';
  lastPaymentDate?: Date;
}

interface RecurringClassForm {
  studentId: string;
  selectedDays: string[];
  time: string;
  startDate: string;
  monthsToGenerate: number;
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './students.component.html',
  styleUrls: ['./students.component.scss']
})
export class StudentsComponent implements OnInit {
  students: StudentInfo[] = [];
  allClasses: Class[] = [];
  isTeacher = false;
  loading = true;
  currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Recurring class scheduling
  showRecurringModal = false;
  creatingClasses = false;
  resettingClasses = false;
  recurringForm: RecurringClassForm = {
    studentId: '',
    selectedDays: [],
    time: '',
    startDate: '',
    monthsToGenerate: 6
  };

  // Timezone properties
  teacherTimezone = 'IST'; // Default to IST, should be loaded from user profile
  availableTimezones = this.timezoneService.getAvailableTimezones();

  weekDays = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' }
  ];

  constructor(
    private authService: AuthService,
    private firestoreService: FirestoreService,
    private timezoneService: TimezoneService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    
    if (!this.isTeacher) {
      // Redirect non-teachers or handle appropriately
      this.loading = false;
      return;
    }

    // Load teacher's timezone preference
    this.teacherTimezone = user?.timezone || 'IST';

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

    // Count remaining classes this month
    const remainingClassesThisMonth = studentClasses.filter(cls => {
      const classDate = new Date(cls.classDate);
      return classDate >= now && classDate <= monthEnd;
    }).length;

    // Mock fee payment status (you would get this from your payment system)
    const feePaymentStatus = this.calculateFeeStatus(student);

    return {
      ...student,
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

  // Recurring class scheduling methods
  openRecurringClassModal(student: StudentInfo): void {
    this.recurringForm = {
      studentId: student.uid || '',
      selectedDays: [],
      time: '16:00', // Default to 4 PM
      startDate: new Date().toISOString().split('T')[0], // Today's date
      monthsToGenerate: 6
    };
    this.showRecurringModal = true;
  }

  closeRecurringModal(): void {
    this.showRecurringModal = false;
    this.recurringForm = {
      studentId: '',
      selectedDays: [],
      time: '',
      startDate: '',
      monthsToGenerate: 6
    };
  }

  onDaySelectionChange(dayValue: string, event: any): void {
    if (event.target.checked) {
      if (!this.recurringForm.selectedDays.includes(dayValue)) {
        this.recurringForm.selectedDays.push(dayValue);
      }
    } else {
      this.recurringForm.selectedDays = this.recurringForm.selectedDays.filter(day => day !== dayValue);
    }
  }

  isDaySelected(dayValue: string): boolean {
    return this.recurringForm.selectedDays.includes(dayValue);
  }

  async createRecurringClasses(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    this.creatingClasses = true;
    
    try {
      const student = this.students.find(s => s.uid === this.recurringForm.studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      const teacher = this.authService.getUserData();
      const classes = this.generateRecurringClasses(student, teacher);
      
      // Create all classes in batch
      for (const classData of classes) {
        await this.firestoreService.createClass(classData as Class);
      }

      console.log(`Created ${classes.length} recurring classes for ${student.name}`);
      
      // Refresh the data to show new classes
      await this.loadData();
      
      this.closeRecurringModal();
    } catch (error) {
      console.error('Error creating recurring classes:', error);
      alert('Failed to create recurring classes. Please try again.');
    } finally {
      this.creatingClasses = false;
    }
  }

  private isFormValid(): boolean {
    return !!(
      this.recurringForm.studentId &&
      this.recurringForm.selectedDays.length > 0 &&
      this.recurringForm.time &&
      this.recurringForm.startDate &&
      this.recurringForm.monthsToGenerate > 0
    );
  }

  private generateRecurringClasses(student: StudentInfo, teacher: any): Partial<Class>[] {
    const classes: Partial<Class>[] = [];
    const startDate = new Date(this.recurringForm.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + this.recurringForm.monthsToGenerate);

    // Convert selected days to numbers
    const selectedDayNumbers = this.recurringForm.selectedDays.map(day => parseInt(day));

    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (selectedDayNumbers.includes(dayOfWeek)) {
        // Create class for this day
        const classDateTime = new Date(currentDate);
        const [hours, minutes] = this.recurringForm.time.split(':');
        classDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Only create classes for future dates
        if (classDateTime > new Date()) {
          // Create UTC version of the class date for consistent storage
          const utcClassDate = this.timezoneService.createUTCFromLocalTime(
            this.recurringForm.time,
            classDateTime,
            this.teacherTimezone
          );

          const classData: Partial<Class> = {
            studentName: student.name || 'Unknown Student',
            name: `Class for ${student.name || 'Unknown Student'}`,
            subject: 'Music Lesson',
            timeSlot: this.recurringForm.time,
            teacherId: teacher?.uid || '',
            classDate: classDateTime, // Local time for display
            utcDate: utcClassDate, // UTC time for consistent storage
            timezone: this.teacherTimezone, // Teacher's timezone
            studentUid: student.uid || '',
            studentEmail: student.email || '',
            isRecurring: true,
            recurringId: `${student.uid || 'unknown'}_recurring_${Date.now()}`
          } as any;

          classes.push(classData);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return classes;
  }

  getSelectedStudent(): StudentInfo | null {
    return this.students.find(s => s.uid === this.recurringForm.studentId) || null;
  }

  getSelectedDaysText(): string {
    if (this.recurringForm.selectedDays.length === 0) {
      return 'No days selected';
    }
    
    const dayNames = this.recurringForm.selectedDays
      .map(dayValue => this.weekDays.find(day => day.value === dayValue)?.label)
      .filter(Boolean)
      .sort((a, b) => {
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return dayOrder.indexOf(a!) - dayOrder.indexOf(b!);
      });
    
    return dayNames.join(', ');
  }

  /**
   * Convert scheduled time to student's timezone for preview
   */
  getConvertedTimeForStudent(): string {
    if (!this.recurringForm.time || !this.recurringForm.startDate) return '';
    
    const selectedStudent = this.getSelectedStudent();
    if (!selectedStudent?.timezone || selectedStudent.timezone === this.teacherTimezone) return '';

    try {
      // Create a date with the selected time
      const tempDate = new Date(`${this.recurringForm.startDate}T${this.recurringForm.time}`);
      
      // Convert from teacher's timezone to student's timezone
      const convertedDate = this.timezoneService.convertTimezone(
        tempDate,
        this.teacherTimezone,
        selectedStudent.timezone
      );
      
      // Format as time only
      return convertedDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error converting time for student:', error);
      return '';
    }
  }

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async resetFutureClasses(): Promise<void> {
    const student = this.getSelectedStudent();
    if (!student) {
      return;
    }

    if (!confirm(`Are you sure you want to delete all future classes for ${student.name}? This action cannot be undone.`)) {
      return;
    }

    this.resettingClasses = true;

    try {
      // Get all classes for this student
      const allClasses = await firstValueFrom(this.firestoreService.getClasses());
      const now = new Date();

      // Filter to get future classes for this student
      const futureClasses = allClasses.filter(cls => {
        const classDate = new Date(cls.classDate);
        const studentUid = (cls as any).studentUid;
        const studentEmail = ((cls as any).studentEmail || '').trim().toLowerCase();
        const studentName = ((cls.studentName || cls.name) || '').trim().toLowerCase();
        
        // Check if class belongs to this student and is in the future
        const belongsToStudent = 
          (studentUid && studentUid === student.uid) ||
          (studentEmail && student.email && studentEmail === student.email.trim().toLowerCase()) ||
          (studentName && student.name && studentName === student.name.trim().toLowerCase());

        return belongsToStudent && classDate > now;
      });

      // Delete all future classes
      for (const classToDelete of futureClasses) {
        await this.firestoreService.deleteClass(classToDelete.id);
      }

      console.log(`Deleted ${futureClasses.length} future classes for ${student.name}`);
      
      // Refresh the data
      await this.loadData();
      
      alert(`Successfully deleted ${futureClasses.length} future classes for ${student.name}.`);
    } catch (error) {
      console.error('Error deleting future classes:', error);
      alert('Failed to delete future classes. Please try again.');
    } finally {
      this.resettingClasses = false;
    }
  }
}