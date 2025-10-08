import { Component, OnInit } from '@angular/core';
import { CalendarService } from '../services/calendar.service';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../services/auth.service';
import { TimezoneService } from '../services/timezone.service';
import { auth } from '../firebase';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Slot {
  date: Date;
  classId?: string;
  classInfo?: any;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  // simple week view starting today
  days: Date[] = [];
  allHours = Array.from({ length: 48 }, (_, i) => i * 0.5); // 0, 0.5, 1, 1.5, ... 23.5 (30-minute intervals)
  activeHours = Array.from({ length: 32 }, (_, i) => 4.5 + (i * 0.5)); // 4:30 AM to 8:00 PM in 30-min intervals
  hours = this.activeHours; // default to active hours
  slots: Slot[][] = [];
  classes: any[] = [];
  users: any[] = [];
  isTeacher = false;
  editingSlot: Slot | null = null;
  reschedulingClass: any = null;
  selectedStudentUid = '';
  showAllHours = false;
  // subject removed; only studentName is used
  
  // Timezone properties
  userTimezone = 'IST'; // Default to IST, should be loaded from user profile
  availableTimezones = this.timezoneService.getAvailableTimezones();
  
  // Rescheduling form
  rescheduleForm = {
    newDate: '',
    newTime: '',
    studentId: ''
  };

  constructor(
    private calendarService: CalendarService, 
    private firestore: FirestoreService, 
    private auth: AuthService,
    private timezoneService: TimezoneService
  ) {}

  // week navigation state
  startOfWeek = new Date();
  minWeekOffset = -52; // up to 1 year back
  maxWeekOffset = 52; // up to 1 year forward
  currentWeekOffset = 0;

  ngOnInit(): void {
    console.log('CalendarComponent: ngOnInit');
    this.setWeekOffset(0);
    this.buildSlots();
    // Only load data if we're authenticated — guard should stop anonymous access, but be defensive
    if (this.auth.isLoggedIn()) {
      this.loadData();
    }
    const user = this.auth.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    this.userTimezone = user?.timezone || 'IST'; // Load user's timezone preference
    this.auth.user$.subscribe(u => {
      this.isTeacher = !!(u && u.role === 'teacher');
      this.userTimezone = u?.timezone || 'IST';
      // Refresh calendar display when timezone changes
      this.mapClassesToSlots();
    });
  }

  // Human-friendly week range for header, e.g. "Oct 6 - 12, 2025" or "Oct 28 - Nov 3, 2025"
  get weekRange(): string {
    if (!this.days || this.days.length < 7) return '';
    const start = this.days[0];
    const end = this.days[6];
    if (!start || !end) return '';

    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      if (startMonth === endMonth) {
        // Same month and year: "Oct 6 - 12, 2025"
        return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
      } else {
        // Same year, different months: "Oct 28 - Nov 3, 2025"
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
      }
    }
    // Different years: "Dec 30, 2025 - Jan 5, 2026"
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
  }

  buildSlots() {
    this.slots = this.hours.map(h => this.days.map(d => {
      const wholeHour = Math.floor(h);
      const minutes = (h % 1) * 60;
      return { date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), wholeHour, minutes) };
    }));
  }

  loadData() {
    console.log('CalendarComponent: loadData - subscribing to classes and users');
    this.calendarService.getClasses().subscribe(cs => {
      console.log('CalendarComponent: loaded classes', cs);
      this.classes = cs as any[];
      this.mapClassesToSlots();
    });
    this.firestore.getUsers().subscribe(u => {
      console.log('CalendarComponent: loaded users', u);
      this.users = (u || []).filter(x => x.role !== 'teacher');
    });
  }

  // week navigation helpers
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
    this.buildSlots();
  }

  prevWeek() {
    this.setWeekOffset(this.currentWeekOffset - 1);
    this.loadData();
  }

  nextWeek() {
    this.setWeekOffset(this.currentWeekOffset + 1);
    this.loadData();
  }

  goToCurrentWeek() {
    this.setWeekOffset(0);
    this.loadData();
  }

  mapClassesToSlots() {
    console.log('CalendarComponent: mapping classes to slots', this.classes.length);
    // clear class associations
    this.slots.forEach(row => row.forEach(s => { s.classId = undefined; s.classInfo = undefined; }));
    for (const cls of this.classes) {
      const d = new Date(cls.classDate);
      const dayIndex = this.days.findIndex(dd => dd.toDateString() === d.toDateString());
      const classHour = d.getHours() + (d.getMinutes() / 60); // Convert to fractional hour
      const hourIndex = this.hours.findIndex(h => Math.abs(h - classHour) < 0.25); // Allow 15-minute tolerance
      if (dayIndex >= 0 && hourIndex >= 0) {
        const slot = this.slots[hourIndex][dayIndex];
        slot.classId = cls.id;
        slot.classInfo = cls;
      }
    }
    console.log('CalendarComponent: completed mapping classes to slots');
  }

  onSlotClick(slot: Slot) {
    console.log('CalendarComponent: onSlotClick', { slot, isTeacher: this.isTeacher });
    if (!this.isTeacher) return;
    
    if (slot.classId && slot.classInfo) {
      // Clicking on an occupied slot - show reschedule option
      this.openRescheduleModal(slot.classInfo);
    } else {
      // Clicking on empty slot - show assign option
      this.editingSlot = slot;
      this.selectedStudentUid = '';
    }
  }

  toggleHoursView() {
    this.showAllHours = !this.showAllHours;
    this.hours = this.showAllHours ? this.allHours : this.activeHours;
    this.buildSlots();
    this.mapClassesToSlots();
  }

  openRescheduleModal(classInfo: any) {
    this.reschedulingClass = classInfo;
    const classDate = new Date(classInfo.classDate);
    this.rescheduleForm = {
      newDate: classDate.toISOString().split('T')[0],
      newTime: classDate.toTimeString().split(':').slice(0, 2).join(':'),
      studentId: classInfo.studentUid || ''
    };
  }

  closeRescheduleModal() {
    this.reschedulingClass = null;
    this.rescheduleForm = {
      newDate: '',
      newTime: '',
      studentId: ''
    };
  }

  async rescheduleClass() {
    if (!this.reschedulingClass || !this.rescheduleForm.newDate || !this.rescheduleForm.newTime) {
      return;
    }

    try {
      // Create new date from form inputs in teacher's timezone
      const newDateTime = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newTime}`);
      
      // Create UTC version for consistent storage
      const utcClassDate = this.timezoneService.createUTCFromLocalTime(
        this.rescheduleForm.newTime,
        newDateTime,
        this.userTimezone
      );

      // Get student timezone for proper notification
      const studentTimezone = this.reschedulingClass.studentTimezone || 'IST';

      // Update the class with new date/time and timezone information
      const updatedClass = {
        ...this.reschedulingClass,
        classDate: newDateTime, // Local time in teacher's timezone
        utcDate: utcClassDate, // UTC time for consistent storage
        timeSlot: this.rescheduleForm.newTime,
        timezone: this.userTimezone, // Teacher's timezone
        studentTimezone: studentTimezone // Preserve student's timezone
      };

      await this.calendarService.updateClass(updatedClass);
      console.log('Class rescheduled successfully with timezone awareness', {
        originalTime: this.reschedulingClass.classDate,
        newTime: newDateTime,
        utcTime: utcClassDate,
        teacherTimezone: this.userTimezone,
        studentTimezone: studentTimezone
      });
      
      // Close the modal after successful reschedule
      this.closeRescheduleModal();
      
      // Refresh calendar to show updated class
      this.loadData();
    } catch (error) {
      console.error('Error rescheduling class:', error);
      // Optionally show error message to user here
      // For now, we'll still close the modal even on error
      this.closeRescheduleModal();
    }
  }

  async assignClass() {
    if (!this.editingSlot) return;
    const teacher = this.auth.getUserData();
    // Prefer the real Firebase auth UID to ensure it matches the security rules
    const currentUid = auth.currentUser?.uid || teacher?.uid || '';
    
    // Get the selected student's timezone for proper time display
    const selectedStudent = this.users.find(u => u.uid === this.selectedStudentUid);
    const studentTimezone = selectedStudent?.timezone || 'IST';
    
    // Format the time slot properly
    const wholeHour = Math.floor(this.editingSlot.date.getHours());
    const minutes = this.editingSlot.date.getMinutes();
    const timeSlot = `${wholeHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Create UTC version of the class date for consistent storage
    const utcClassDate = this.timezoneService.createUTCFromLocalTime(
      timeSlot,
      this.editingSlot.date,
      this.userTimezone
    );
    
    const newClass: any = {
      studentName: selectedStudent?.name || '',
      studentUid: this.selectedStudentUid || '',
      studentEmail: selectedStudent?.email || '',
      timeSlot: timeSlot,
      teacherId: currentUid,
      classDate: this.editingSlot.date, // Local time in teacher's timezone
      utcDate: utcClassDate, // UTC time for consistent storage
      timezone: this.userTimezone, // Teacher's timezone
      studentTimezone: studentTimezone // Student's timezone for display
    };
    console.log('assignClass: creating with timezone awareness', { 
      currentUid, 
      teacherTimezone: this.userTimezone,
      studentTimezone,
      localTime: this.editingSlot.date,
      utcTime: utcClassDate,
      newClass 
    });
    try {
      const res = await this.calendarService.addClass(newClass as any);
      console.log('assignClass: created class id', res?.id || res);
      this.editingSlot = null;
      this.loadData();
    } catch (err) {
      console.error('assignClass error', err);
    }
  }

  /**
   * Format a class time for display in the user's timezone
   */
  formatClassTime(classInfo: any): string {
    if (!classInfo || !classInfo.classDate) return '';
    
    const classDate = new Date(classInfo.classDate);
    const originalTimezone = classInfo.timezone || 'UTC';
    
    // If the class has a different timezone than the user's, convert it
    if (originalTimezone !== this.userTimezone) {
      const convertedDate = this.timezoneService.convertTimezone(
        classDate, 
        originalTimezone, 
        this.userTimezone
      );
      return this.timezoneService.formatInTimezone(convertedDate, this.userTimezone, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    }
    
    return this.timezoneService.formatInTimezone(classDate, this.userTimezone, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Format hour display (including 30-minute intervals)
   */
  formatHour(hour: number): string {
    const wholeHour = Math.floor(hour);
    const minutes = (hour % 1) * 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    
    let displayHour = wholeHour;
    if (wholeHour > 12) {
      displayHour = wholeHour - 12;
    } else if (wholeHour === 0) {
      displayHour = 12;
    }
    
    const minuteStr = minutes === 0 ? '00' : minutes.toString().padStart(2, '0');
    return `${displayHour}:${minuteStr} ${period}`;
  }

  /**
   * Format time in student's timezone for reschedule modal
   */
  formatTimeInStudentTimezone(classInfo: any): string {
    if (!classInfo || !classInfo.classDate || !classInfo.studentTimezone) return '';
    
    const classDate = new Date(classInfo.classDate);
    const teacherTimezone = classInfo.timezone || this.userTimezone;
    
    if (teacherTimezone !== classInfo.studentTimezone) {
      const convertedDate = this.timezoneService.convertTimezone(
        classDate,
        teacherTimezone,
        classInfo.studentTimezone
      );
      return this.timezoneService.formatInTimezone(convertedDate, classInfo.studentTimezone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    }
    
    return this.timezoneService.formatInTimezone(classDate, classInfo.studentTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get preview time in teacher's timezone
   */
  getPreviewTime(): string {
    if (!this.rescheduleForm.newDate || !this.rescheduleForm.newTime) return '';
    
    const previewDate = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newTime}`);
    return this.timezoneService.formatInTimezone(previewDate, this.userTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get preview time in student's timezone
   */
  getPreviewTimeForStudent(): string {
    if (!this.rescheduleForm.newDate || !this.rescheduleForm.newTime || !this.reschedulingClass?.studentTimezone) return '';
    
    const previewDate = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newTime}`);
    const convertedDate = this.timezoneService.convertTimezone(
      previewDate,
      this.userTimezone,
      this.reschedulingClass.studentTimezone
    );
    
    return this.timezoneService.formatInTimezone(convertedDate, this.reschedulingClass.studentTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get selected student's timezone
   */
  getSelectedStudentTimezone(): string {
    if (!this.selectedStudentUid) return '';
    const student = this.users.find(u => u.uid === this.selectedStudentUid);
    return student?.timezone || 'IST';
  }

  /**
   * Get student time preview for scheduling
   */
  getStudentTimePreview(): string {
    if (!this.editingSlot || !this.selectedStudentUid) return '';
    
    const studentTimezone = this.getSelectedStudentTimezone();
    if (studentTimezone === this.userTimezone) return '';
    
    const convertedDate = this.timezoneService.convertTimezone(
      this.editingSlot.date,
      this.userTimezone,
      studentTimezone
    );
    
    return this.timezoneService.formatInTimezone(convertedDate, studentTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Handle timezone change during scheduling
   */
  onTimezoneChange(): void {
    // Refresh the time displays when timezone changes
    if (this.editingSlot) {
      // Update the editing slot date to reflect the new timezone
      // This ensures the preview times are recalculated
      this.mapClassesToSlots();
    }
  }
}