import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { TimezoneService } from '../services/timezone.service';
import { User } from '../models/user.model';
import { Class } from '../models/class.model';
import { combineLatest, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface StudentInfo extends User {
  remainingClassesThisMonth: number;
  feePaymentStatus: 'paid' | 'pending' | 'overdue';
  lastPaymentDate?: Date;
}

interface RecurringClassForm {
  studentId: string;
  selectedDays: string[];
  startTime: string;      // chosen start time
  durationMinutes: number; // 30,45,60
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
export class StudentsComponent implements OnInit, OnDestroy {
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
    startTime: '',
    durationMinutes: 30,
    startDate: '',
    monthsToGenerate: 6
  };
  recurringConflictError = '';
  startTimeOptions: { time: string; available: boolean }[] = [];

  private dataSub: Subscription | null = null;
  private authSub: Subscription | null = null;
  private usersLoaded = false;
  private classesLoaded = false;

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
    // Wait reactively for auth to initialize and confirm teacher role
    this.authSub = this.authService.user$
      .pipe(filter(u => u !== undefined)) // skip until auth resolved
      .subscribe(user => {
        this.isTeacher = !!(user && user.role === 'teacher');
        if (!this.isTeacher) {
          this.loading = false;
          return;
        }
        // Teacher auth ready; capture timezone and start data streams if not already
        this.teacherTimezone = user?.timezone || 'IST';
        if (!this.dataSub) {
          this.initializeDataStreams();
        }
      });
  }

  private initializeDataStreams() {
    const users$ = this.firestoreService.getUsers();
    const classes$ = this.firestoreService.getClasses();

    this.dataSub = combineLatest([users$, classes$]).subscribe({
      next: ([users, classes]) => {
        this.usersLoaded = true;
        this.classesLoaded = true;
        this.allClasses = classes || [];
        const studentUsers = (users || []).filter(u => u.role === 'student');
        this.students = studentUsers.map(s => this.calculateStudentInfo(s));
        // Recompute time options reactively when classes change
        this.refreshTimeOptions();
        this.loading = false;
      },
      error: err => {
        console.error('Error in students/classes stream', err);
        this.loading = false;
      }
    });
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
      startTime: '',
      durationMinutes: 30,
      startDate: new Date().toISOString().split('T')[0],
      monthsToGenerate: 6
    };
    this.startTimeOptions = this.computeStartTimeOptions();
    this.recurringConflictError = '';
    this.showRecurringModal = true;
  }

  closeRecurringModal(): void {
    this.showRecurringModal = false;
    this.recurringForm = {
      studentId: '',
      selectedDays: [],
      startTime: '',
      durationMinutes: 30,
      startDate: '',
      monthsToGenerate: 6
    };
    this.recurringConflictError = '';
  }

  onDaySelectionChange(dayValue: string, event: any): void {
    if (event.target.checked) {
      if (!this.recurringForm.selectedDays.includes(dayValue)) {
        this.recurringForm.selectedDays.push(dayValue);
      }
    } else {
      this.recurringForm.selectedDays = this.recurringForm.selectedDays.filter(day => day !== dayValue);
    }
    this.startTimeOptions = this.computeStartTimeOptions();
    this.detectRecurringConflicts();
  }

  onDurationChange(): void {
    this.startTimeOptions = this.computeStartTimeOptions();
    if (this.recurringForm.startTime && !this.isTimeCurrentlyAvailable(this.recurringForm.startTime)) {
      this.recurringForm.startTime = '';
    }
    this.detectRecurringConflicts();
  }

  onStartTimeChange(): void {
    this.detectRecurringConflicts();
  }

  onStartDateChange(): void {
    this.startTimeOptions = this.computeStartTimeOptions();
    if (this.recurringForm.startTime && !this.isTimeCurrentlyAvailable(this.recurringForm.startTime)) {
      this.recurringForm.startTime = '';
    }
    this.detectRecurringConflicts();
  }

  isDaySelected(dayValue: string): boolean {
    return this.recurringForm.selectedDays.includes(dayValue);
  }

  async createRecurringClasses(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }
    this.detectRecurringConflicts();
    if (this.recurringConflictError) {
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
  // No explicit reload needed; realtime streams will update automatically
      
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
      this.recurringForm.startTime &&
      this.recurringForm.durationMinutes > 0 &&
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
        const classDateTime = new Date(currentDate);
        const [h, m] = this.recurringForm.startTime.split(':');
        classDateTime.setHours(parseInt(h), parseInt(m), 0, 0);
        if (classDateTime > new Date()) {
          const utcClassDate = this.timezoneService.createUTCFromLocalTime(
            this.recurringForm.startTime,
            classDateTime,
            this.teacherTimezone
          );
          const endTime = this.computeEndTime(this.recurringForm.startTime, this.recurringForm.durationMinutes);
          const classData: Partial<Class> = {
            studentName: student.name || 'Unknown Student',
            name: `Class for ${student.name || 'Unknown Student'}`,
            subject: 'Music Lesson',
            timeSlot: `${this.recurringForm.startTime} - ${endTime}`,
            teacherId: teacher?.uid || '',
            classDate: classDateTime,
            utcDate: utcClassDate,
            timezone: this.teacherTimezone,
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
    if (!this.recurringForm.startTime || !this.recurringForm.startDate) return '';
    const selectedStudent = this.getSelectedStudent();
    if (!selectedStudent?.timezone || selectedStudent.timezone === this.teacherTimezone) return '';
    try {
      const buildDate = (time: string) => new Date(`${this.recurringForm.startDate}T${time}`);
      const fromLocal = buildDate(this.recurringForm.startTime);
      const endTime = this.computeEndTime(this.recurringForm.startTime, this.recurringForm.durationMinutes);
      const toLocal = buildDate(endTime);
      const fromConverted = this.timezoneService.convertTimezone(fromLocal, this.teacherTimezone, selectedStudent.timezone);
      const toConverted = this.timezoneService.convertTimezone(toLocal, this.teacherTimezone, selectedStudent.timezone);
      const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${fmt(fromConverted)} - ${fmt(toConverted)}`;
    } catch (error) {
      console.error('Error converting time for student:', error);
      return '';
    }
  }

  computeEndTime(start: string, duration: number): string {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const dur = typeof duration === 'string' ? parseInt(duration, 10) : duration;
    if (!Number.isFinite(dur)) return '';
    const total = h * 60 + m + dur;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${eh.toString().padStart(2,'0')}:${em.toString().padStart(2,'0')}`;
  }

  private parseTimeSlot(slot: string): { start: number; end: number } | null {
    if (!slot) return null;
    if (slot.includes('-')) {
      const [a,b] = slot.split('-').map(s => s.trim());
      const toMin = (t: string) => { const [hh,mm]=t.split(':').map(Number); return hh*60+mm; };
      if (/^\d{1,2}:\d{2}$/.test(a) && /^\d{1,2}:\d{2}$/.test(b)) {
        return { start: toMin(a), end: toMin(b) };
      }
    } else if (/^\d{1,2}:\d{2}$/.test(slot)) {
      const [hh,mm] = slot.split(':').map(Number); return { start: hh*60+mm, end: hh*60+mm+30 };
    }
    return null;
  }

  private existingClassConflict(date: Date, startMinutes: number, endMinutes: number): boolean {
    return this.allClasses.some(cls => {
      const clsDate = new Date(cls.classDate);
      if (clsDate.toDateString() !== date.toDateString()) return false;
      const parsed = this.parseTimeSlot(cls.timeSlot);
      if (!parsed) return false;
      return startMinutes < parsed.end && parsed.start < endMinutes;
    });
  }

  private computeStartTimeOptions(): { time: string; available: boolean }[] {
    const options: { time: string; available: boolean }[] = [];
    for (let m=5*60; m<=22*60; m+=30) {
      const time = `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`;
      options.push({ time, available: true });
    }
    if (this.recurringForm.selectedDays.length === 0) return options; // all shown as available until days picked
    const dayNumbers = this.recurringForm.selectedDays.map(d=>parseInt(d,10));
    const relevantClasses = this.allClasses.filter(cls => dayNumbers.includes(new Date(cls.classDate).getDay()));
    const classRanges = relevantClasses.map(cls => this.parseTimeSlot(cls.timeSlot)).filter(Boolean) as {start:number; end:number}[];
    const dur = typeof this.recurringForm.durationMinutes === 'string' ? parseInt(this.recurringForm.durationMinutes as any, 10) : this.recurringForm.durationMinutes;
    return options.map(o => {
      const [h,mm] = o.time.split(':').map(Number);
      const startMin = h*60+mm;
      const endMin = startMin + dur;
      const overlap = classRanges.some(r => startMin < r.end && r.start < endMin);
      return { time: o.time, available: !overlap };
    });
  }

  private isTimeCurrentlyAvailable(time: string): boolean {
    return this.startTimeOptions.find(o => o.time === time)?.available ?? true;
  }

  private refreshTimeOptions(): void {
    this.startTimeOptions = this.computeStartTimeOptions();
    if (this.recurringForm.startTime && !this.isTimeCurrentlyAvailable(this.recurringForm.startTime)) {
      // keep selection but warn user by setting conflict error if needed
      // or clear it; choose to clear for safety
      this.recurringForm.startTime = '';
    }
  }

  detectRecurringConflicts(): void {
    this.recurringConflictError = '';
    if (!this.isFormValid()) return;
    const classes = this.generateRecurringClasses(this.getSelectedStudent() as any, this.authService.getUserData());
    const conflict = classes.some(c => {
      const parsed = this.parseTimeSlot(c.timeSlot as any);
      if (!parsed) return false;
      const date = new Date(c.classDate as any);
      return this.existingClassConflict(date, parsed.start, parsed.end);
    });
    if (conflict) {
      this.recurringConflictError = 'One or more generated classes conflict with existing classes. Adjust time / days.';
    }
  }

  getTeacherTimezoneDisplayName(): string {
    return this.teacherTimezone;
  }

  getSelectedStudentTimezoneDisplayName(): string {
    return this.getSelectedStudent()?.timezone || '';
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
  // We already have real-time classes in allClasses; just operate on them
  const allClasses = this.allClasses;
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
  // Streams will auto-update; no manual reload
      
      alert(`Successfully deleted ${futureClasses.length} future classes for ${student.name}.`);
    } catch (error) {
      console.error('Error deleting future classes:', error);
      alert('Failed to delete future classes. Please try again.');
    } finally {
      this.resettingClasses = false;
    }
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }
}