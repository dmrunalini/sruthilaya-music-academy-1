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
  // 15-minute resolution to support quarter-hour scheduling
  allHours = Array.from({ length: 96 }, (_, i) => i * 0.25); // 0,0.25,0.5,...,23.75
  activeHours = Array.from({ length: ((20 - 4.5) / 0.25) + 1 }, (_, i) => 4.5 + (i * 0.25)); // 4:30 AM to 8:00 PM in 15-min intervals
  hours = this.activeHours; // default to active hours
  slots: Slot[][] = [];
  classes: any[] = [];
  users: any[] = [];
  isTeacher = false;
  skippedClassCount = 0;
  editingSlot: Slot | null = null;
  reschedulingClass: any = null;
  selectedStudentUid = '';
  showAllHours = false;
  // subject removed; only studentName is used
  
  // Timezone properties
  userTimezone = 'IST'; // Default to IST, should be loaded from user profile
  availableTimezones = this.timezoneService.getAvailableTimezones();
  
  // Scheduling form (start time + duration)
  scheduleForm = {
    startTime: '',
    durationMinutes: 30
  };
  scheduleTimeOptions: { time: string; available: boolean }[] = [];

  // Rescheduling form
  rescheduleForm = {
    newDate: '',
    newStartTime: '',
    durationMinutes: 30,
    studentId: ''
  };
  rescheduleTimeOptions: { time: string; available: boolean }[] = [];

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
    console.log('CalendarComponent: mapping classes to slots (timezone =', this.userTimezone, ') total classes =', this.classes.length);
    // clear class associations first
    this.slots.forEach(row => row.forEach(s => { s.classId = undefined; s.classInfo = undefined; }));

    const tz = this.userTimezone;
  this.skippedClassCount = 0;

    for (const cls of this.classes) {
      // Normalize raw date (prefer utcDate) which may be:
      // - JS Date
      // - Firestore Timestamp (has toDate())
      // - ISO string
      // - Possibly undefined / invalid
      const rawSource = cls.utcDate || cls.classDate;
      let rawUtc: Date;
      if (!rawSource) {
        continue; // nothing to map
      } else if (rawSource instanceof Date) {
        rawUtc = rawSource;
      } else if (typeof rawSource === 'object' && typeof (rawSource as any).toDate === 'function') {
        try { rawUtc = (rawSource as any).toDate(); } catch { continue; }
      } else if (typeof rawSource === 'string' || typeof rawSource === 'number') {
        rawUtc = new Date(rawSource);
      } else {
        // unknown shape
        continue;
      }

      if (isNaN(rawUtc.getTime())) {
        this.skippedClassCount++;
        continue; // skip invalid
      }

      const displayDate = this.getDisplayDateForTimezone(rawUtc, tz);
      if (!(displayDate instanceof Date) || isNaN(displayDate.getTime())) {
        this.skippedClassCount++;
        continue;
      }

      const dayIndex = this.days.findIndex(dd => dd.toDateString() === displayDate.toDateString());
      const classHour = displayDate.getHours() + (displayDate.getMinutes() / 60);
  // Threshold is half the step (0.25/2 = 0.125) for 15-min resolution
  const hourIndex = this.hours.findIndex(h => Math.abs(h - classHour) < 0.125);
      if (dayIndex >= 0 && hourIndex >= 0) {
        const slot = this.slots[hourIndex][dayIndex];
        slot.classId = cls.id;
        // Attach derived display date so templates / modals can show correct local time
        slot.classInfo = { ...cls, _displayDate: displayDate };
      }
    }
    console.log('CalendarComponent: completed mapping classes to slots (timezone applied)');
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
      const h = slot.date.getHours().toString().padStart(2,'0');
      const m = slot.date.getMinutes().toString().padStart(2,'0');
      this.scheduleForm = { startTime: `${h}:${m}`, durationMinutes: 30 };
      this.scheduleTimeOptions = this.computeScheduleTimeOptions();
      if (!this.isScheduleStartTimeAvailable(this.scheduleForm.startTime)) {
        const first = this.scheduleTimeOptions.find(o => o.available);
        this.scheduleForm.startTime = first ? first.time : '';
      }
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
    const isoDate = classDate.toISOString().split('T')[0];
    // derive start/end from timeSlot
    let startTime = classInfo.timeSlot?.split(' - ')[0] || classDate.toTimeString().slice(0,5);
    let endTime = classInfo.timeSlot?.split(' - ')[1] || startTime;
    const duration = this.diffMinutes(startTime, endTime) || 30;
    this.rescheduleForm = {
      newDate: isoDate,
      newStartTime: startTime,
      durationMinutes: duration === 45 || duration === 60 ? duration : 30,
      studentId: classInfo.studentUid || ''
    };
    this.rescheduleTimeOptions = this.computeRescheduleTimeOptions();
  }

  closeRescheduleModal() {
    this.reschedulingClass = null;
    this.rescheduleForm = {
      newDate: '',
      newStartTime: '',
      durationMinutes: 30,
      studentId: ''
    };
    this.rescheduleTimeOptions = [];
  }

  async cancelClass() {
    if (!this.reschedulingClass) return;
    
    const confirmCancel = confirm(`Are you sure you want to cancel this class?\n\nClass: ${this.reschedulingClass.studentName}\nTime: ${this.formatClassTime(this.reschedulingClass)}\n\nThis action cannot be undone.`);
    
    if (confirmCancel) {
      try {
        await this.calendarService.deleteClass(this.reschedulingClass.id);
        console.log('Class cancelled successfully');
        this.closeRescheduleModal();
        this.loadData(); // Refresh the calendar
      } catch (error) {
        console.error('Error cancelling class:', error);
        alert('Failed to cancel class. Please try again.');
      }
    }
  }

  async rescheduleClass() {
    if (!this.reschedulingClass || !this.rescheduleForm.newDate || !this.rescheduleForm.newStartTime) {
      return;
    }

    try {
      const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
      const newDateTime = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newStartTime}`);
      
      // Create UTC version for consistent storage
      const utcClassDate = this.timezoneService.createUTCFromLocalTime(
        this.rescheduleForm.newStartTime,
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
        timeSlot: `${this.rescheduleForm.newStartTime} - ${endTime}`,
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
    if (!this.editingSlot || !this.scheduleForm.startTime) return;
    const teacher = this.auth.getUserData();
    // Prefer the real Firebase auth UID to ensure it matches the security rules
    const currentUid = auth.currentUser?.uid || teacher?.uid || '';
    
    // Get the selected student's timezone for proper time display
    const selectedStudent = this.users.find(u => u.uid === this.selectedStudentUid);
    const studentTimezone = selectedStudent?.timezone || 'IST';
    
    // Create class date with the selected from time
    const classDate = new Date(this.editingSlot.date);
  const [fromHours, fromMinutes] = this.scheduleForm.startTime.split(':');
    classDate.setHours(parseInt(fromHours), parseInt(fromMinutes), 0, 0);
    
    // Format the time slot as range
  const endTime = this.computeEndTime(this.scheduleForm.startTime, this.scheduleForm.durationMinutes);
  const timeSlot = `${this.scheduleForm.startTime} - ${endTime}`;
    
    // Create UTC version of the class date for consistent storage
    const utcClassDate = this.timezoneService.createUTCFromLocalTime(
      this.scheduleForm.startTime,
      classDate,
      this.userTimezone
    );
    
    const newClass: any = {
      studentName: selectedStudent?.name || '',
      studentUid: this.selectedStudentUid || '',
      studentEmail: selectedStudent?.email || '',
      timeSlot: timeSlot,
      teacherId: currentUid,
      classDate: classDate, // Local time in teacher's timezone with correct from time
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
    const minutes = Math.round((hour - wholeHour) * 60);
    const period = hour >= 12 ? 'PM' : 'AM';
    
    let displayHour = wholeHour;
    if (wholeHour > 12) {
      displayHour = wholeHour - 12;
    } else if (wholeHour === 0) {
      displayHour = 12;
    }
    
    const minuteStr = minutes.toString().padStart(2, '0');
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
  if (!this.rescheduleForm.newDate || !this.rescheduleForm.newStartTime) return '';
  const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
  const fromDate = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newStartTime}`);
  const toDate = new Date(`${this.rescheduleForm.newDate}T${endTime}`);
    
    const fromTime = this.timezoneService.formatInTimezone(fromDate, this.userTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const toTime = this.timezoneService.formatInTimezone(toDate, this.userTimezone, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return `${fromTime} - ${toTime}`;
  }

  /**
   * Get simple preview time without timezone info
   */
  getSimplePreviewTime(): string {
    if (!this.rescheduleForm.newDate || !this.rescheduleForm.newStartTime) return '';
    const date = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newStartTime}`);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
    return `${dateStr} from ${this.rescheduleForm.newStartTime} to ${endTime}`;
  }

  /**
   * Get simple student preview time without timezone info
   */
  getSimpleStudentPreviewTime(): string {
  if (!this.rescheduleForm.newDate || !this.rescheduleForm.newStartTime || !this.reschedulingClass?.studentTimezone) return '';
  const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
  const fromDate = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newStartTime}`);
  const toDate = new Date(`${this.rescheduleForm.newDate}T${endTime}`);
    
    const convertedFromDate = this.timezoneService.convertTimezone(
      fromDate,
      this.userTimezone,
      this.reschedulingClass.studentTimezone
    );
    
    const convertedToDate = this.timezoneService.convertTimezone(
      toDate,
      this.userTimezone,
      this.reschedulingClass.studentTimezone
    );
    
    const dateStr = convertedFromDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const fromTime = convertedFromDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const toTime = convertedToDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateStr} from ${fromTime} to ${toTime}`;
  }

  /**
   * Get preview time in student's timezone
   */
  getPreviewTimeForStudent(): string {
  if (!this.rescheduleForm.newDate || !this.rescheduleForm.newStartTime || !this.reschedulingClass?.studentTimezone) return '';
  const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
  const fromDate = new Date(`${this.rescheduleForm.newDate}T${this.rescheduleForm.newStartTime}`);
  const toDate = new Date(`${this.rescheduleForm.newDate}T${endTime}`);
    
    const convertedFromDate = this.timezoneService.convertTimezone(
      fromDate,
      this.userTimezone,
      this.reschedulingClass.studentTimezone
    );
    
    const convertedToDate = this.timezoneService.convertTimezone(
      toDate,
      this.userTimezone,
      this.reschedulingClass.studentTimezone
    );
    
    const fromTime = this.timezoneService.formatInTimezone(convertedFromDate, this.reschedulingClass.studentTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const toTime = this.timezoneService.formatInTimezone(convertedToDate, this.reschedulingClass.studentTimezone, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return `${fromTime} - ${toTime}`;
  }

  /**
   * Get selected student's timezone
   */
  getSelectedStudentTimezone(): string {
    if (!this.selectedStudentUid) return '';
    const student = this.users.find(u => u.uid === this.selectedStudentUid);
    return student?.timezone || 'IST';
  }

  // Get the display name for a timezone code
  getTimezoneDisplayName(timezoneCode: string): string {
    const timezone = this.availableTimezones.find(tz => tz.code === timezoneCode);
    return timezone ? timezone.name : timezoneCode;
  }

  // Get the current user's timezone display name
  getUserTimezoneDisplayName(): string {
    return this.getTimezoneDisplayName(this.userTimezone);
  }

  // Get the selected student's timezone display name
  getSelectedStudentTimezoneDisplayName(): string {
    const timezoneCode = this.getSelectedStudentTimezone();
    return timezoneCode ? this.getTimezoneDisplayName(timezoneCode) : '';
  }

  /**
   * Get student time preview for scheduling
   */
  getStudentTimePreview(): string {
    if (!this.editingSlot || !this.selectedStudentUid || !this.scheduleForm.startTime) return '';
    const studentTimezone = this.getSelectedStudentTimezone();
    if (studentTimezone === this.userTimezone) return '';
    const fromDate = new Date(this.editingSlot.date);
    const [fh,fm] = this.scheduleForm.startTime.split(':');
    fromDate.setHours(parseInt(fh), parseInt(fm), 0, 0);
    const endTime = this.computeEndTime(this.scheduleForm.startTime, this.scheduleForm.durationMinutes);
    const toDate = new Date(this.editingSlot.date);
    const [th,tm] = endTime.split(':');
    toDate.setHours(parseInt(th), parseInt(tm), 0, 0);
    const convertedFromDate = this.timezoneService.convertTimezone(fromDate, this.userTimezone, studentTimezone);
    const convertedToDate = this.timezoneService.convertTimezone(toDate, this.userTimezone, studentTimezone);
    const fromTime = this.timezoneService.formatInTimezone(convertedFromDate, studentTimezone, { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const toTime = this.timezoneService.formatInTimezone(convertedToDate, studentTimezone, { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });
    return `${fromTime} - ${toTime}`;
  }

  /**
   * Validate that the time range is at least 30 minutes
   */
  isValidTimeRange(fromTime: string, toTime: string): boolean {
    if (!fromTime || !toTime) return false;
    
    const [fromHours, fromMinutes] = fromTime.split(':').map(Number);
    const [toHours, toMinutes] = toTime.split(':').map(Number);
    
    const fromTotalMinutes = fromHours * 60 + fromMinutes;
    const toTotalMinutes = toHours * 60 + toMinutes;
    
    // Ensure to time is after from time and at least 30 minutes difference
    return toTotalMinutes > fromTotalMinutes && (toTotalMinutes - fromTotalMinutes) >= 30;
  }

  /**
   * Check if schedule form is valid
   */
  isScheduleFormValid(): boolean {
    if (!(this.selectedStudentUid && this.scheduleForm.startTime)) return false;
    const endTime = this.computeEndTime(this.scheduleForm.startTime, this.scheduleForm.durationMinutes);
    return this.isValidTimeRange(this.scheduleForm.startTime, endTime) && this.isScheduleStartTimeAvailable(this.scheduleForm.startTime);
  }

  /**
   * Check if reschedule form is valid
   */
  isRescheduleFormValid(): boolean {
    if (!(this.rescheduleForm.newDate && this.rescheduleForm.newStartTime)) return false;
    const endTime = this.computeEndTime(this.rescheduleForm.newStartTime, this.rescheduleForm.durationMinutes);
    return this.isValidTimeRange(this.rescheduleForm.newStartTime, endTime) && this.isRescheduleStartTimeAvailable(this.rescheduleForm.newStartTime);
  }
  private diffMinutes(start: string, end: string): number | null {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh*60+em) - (sh*60+sm);
  }

  private parseTimeSlot(slot: string): { start: number; end: number } | null {
    if (!slot || !slot.includes(' - ')) return null;
    const [a,b] = slot.split(' - ').map(s => s.trim());
    if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return null;
    const toMin = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const sa = toMin(a); const sb = toMin(b);
    return { start: sa, end: sb };
  }

  private computeEndTime(start: string, duration: number): string {
    if (!/^\d{2}:\d{2}$/.test(start)) return start;
    const [h,m] = start.split(':').map(Number);
    const total = h*60 + m + duration;
    const eh = Math.floor(total/60) % 24;
    const em = total % 60;
    return `${eh.toString().padStart(2,'0')}:${em.toString().padStart(2,'0')}`;
  }

  private computeRescheduleTimeOptions(): { time: string; available: boolean }[] {
    const opts: { time: string; available: boolean }[] = [];
    // window 05:00 - 22:00 (15-minute increments for finer rescheduling)
    for (let min=5*60; min<=22*60; min+=15) {
      const h = Math.floor(min/60); const m = min%60;
      opts.push({ time: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`, available: true });
    }
    if (!this.rescheduleForm.newDate) return opts;
    const date = new Date(this.rescheduleForm.newDate);
    // Gather classes that are on that date (exclude the one being rescheduled)
    const sameDayClasses = this.classes.filter(c => {
      if (this.reschedulingClass && c.id === this.reschedulingClass.id) return false;
      const cd = new Date(c.classDate);
      return cd.toDateString() === date.toDateString();
    });
    const ranges = sameDayClasses.map(c => this.parseTimeSlot(c.timeSlot)).filter(Boolean) as {start:number; end:number}[];
    const dur = this.rescheduleForm.durationMinutes;
    return opts.map(o => {
      const [h,m] = o.time.split(':').map(Number);
      const startMin = h*60+m;
      const endMin = startMin + dur;
      const overlap = ranges.some(r => startMin < r.end && r.start < endMin);
      return { time: o.time, available: !overlap };
    });
  }

  isRescheduleStartTimeAvailable(time: string): boolean {
    return this.rescheduleTimeOptions.find(o => o.time === time)?.available ?? true;
  }

  onRescheduleDateChange() {
    this.rescheduleTimeOptions = this.computeRescheduleTimeOptions();
    if (this.rescheduleForm.newStartTime && !this.isRescheduleStartTimeAvailable(this.rescheduleForm.newStartTime)) {
      this.rescheduleForm.newStartTime = '';
    }
  }

  onRescheduleDurationChange() {
    this.rescheduleTimeOptions = this.computeRescheduleTimeOptions();
    if (this.rescheduleForm.newStartTime && !this.isRescheduleStartTimeAvailable(this.rescheduleForm.newStartTime)) {
      this.rescheduleForm.newStartTime = '';
    }
  }

  onRescheduleStartTimeChange() {
    // no-op aside from validation trigger (template uses binding)
  }

  // Called from template after form control changes to refresh preview (availability already handled in specific handlers)
  updatePreviewTimes() {
    // Ensure options reflect any duration/date change if handlers missed
    this.rescheduleTimeOptions = this.computeRescheduleTimeOptions();
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
    // Also remap even if not editing
    this.mapClassesToSlots();
  }

  // ===== Schedule availability utilities (for creating new classes) =====
  private computeScheduleTimeOptions(): { time: string; available: boolean }[] {
    const opts: { time: string; available: boolean }[] = [];
    if (!this.editingSlot) return opts;
    const date = this.editingSlot.date;
    for (let min=5*60; min<=22*60; min+=15) {
      const h = Math.floor(min/60); const m = min%60;
      opts.push({ time: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`, available: true });
    }
    const sameDayClasses = this.classes.filter(c => {
      const cd = new Date(c.classDate);
      return cd.toDateString() === date.toDateString();
    });
    const ranges = sameDayClasses.map(c => this.parseTimeSlot(c.timeSlot)).filter(Boolean) as {start:number; end:number}[];
    const dur = this.scheduleForm.durationMinutes;
    return opts.map(o => {
      const [h,m] = o.time.split(':').map(Number);
      const startMin = h*60+m;
      const endMin = startMin + dur;
      const overlap = ranges.some(r => startMin < r.end && r.start < endMin);
      return { time: o.time, available: !overlap };
    });
  }

  isScheduleStartTimeAvailable(time: string): boolean {
    return this.scheduleTimeOptions.find(o => o.time === time)?.available ?? true;
  }

  onScheduleDurationChange() {
    this.scheduleTimeOptions = this.computeScheduleTimeOptions();
    if (this.scheduleForm.startTime && !this.isScheduleStartTimeAvailable(this.scheduleForm.startTime)) {
      const first = this.scheduleTimeOptions.find(o => o.available);
      this.scheduleForm.startTime = first ? first.time : '';
    }
  }

  onScheduleStartTimeChange() {
    // validation via bindings
  }

  /**
   * Convert a UTC date (or assumed UTC) into a Date representing the wall-clock time in target timezone
   * for purposes of grid placement. We construct a new Date in local environment using the parts for the
   * target timezone so hours/days align with teacher's selected zone.
   */
  private getDisplayDateForTimezone(utcDate: Date, timezoneCode: string): Date {
    try {
      if (!(utcDate instanceof Date) || isNaN(utcDate.getTime())) {
        return utcDate;
      }
      // Map short code to IANA if available
      const tzEntry = this.availableTimezones.find(t => t.code === timezoneCode);
      const iana = tzEntry?.timezone || timezoneCode;
      const options: Intl.DateTimeFormatOptions = {
        timeZone: iana,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      };
      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(utcDate);
      const lookup: any = {};
      for (const p of parts) {
        if (p.type !== 'literal') lookup[p.type] = p.value;
      }
      const year = parseInt(lookup.year, 10);
      const month = parseInt(lookup.month, 10); // 1-based
      const day = parseInt(lookup.day, 10);
      const hour = parseInt(lookup.hour, 10);
      const minute = parseInt(lookup.minute ?? '0', 10);
      const second = parseInt(lookup.second ?? '0', 10);
      if ([year, month, day, hour].some(n => isNaN(n))) {
        return utcDate; // insufficient data; fallback
      }
      // Construct a date in local timezone that represents the wall time in target timezone.
      return new Date(year, month - 1, day, hour, minute, second, 0);
    } catch (e) {
      console.warn('getDisplayDateForTimezone failed, fallback to original date', e);
      return utcDate;
    }
  }
}