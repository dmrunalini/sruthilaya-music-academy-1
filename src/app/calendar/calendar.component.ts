import { Component, OnInit } from '@angular/core';
import { CalendarService } from '../services/calendar.service';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../services/auth.service';
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
  hours = Array.from({ length: 24 }, (_, i) => i); // 0..23
  slots: Slot[][] = [];
  classes: any[] = [];
  users: any[] = [];
  isTeacher = false;
  editingSlot: Slot | null = null;
  selectedStudentUid = '';
  // subject removed; only studentName is used

  constructor(private calendarService: CalendarService, private firestore: FirestoreService, private auth: AuthService) {}

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
    this.auth.user$.subscribe(u => this.isTeacher = !!(u && u.role === 'teacher'));
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
    this.slots = this.hours.map(h => this.days.map(d => ({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h) })));
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
      const hourIndex = this.hours.findIndex(h => h === d.getHours());
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
    if (slot.classId) return; // occupied
    this.editingSlot = slot;
    this.selectedStudentUid = '';
  }

  async assignClass() {
    if (!this.editingSlot) return;
    const teacher = this.auth.getUserData();
    // Prefer the real Firebase auth UID to ensure it matches the security rules
    const currentUid = auth.currentUser?.uid || teacher?.uid || '';
    const newClass: any = {
      studentName: this.users.find(u => u.uid === this.selectedStudentUid)?.name || '',
      studentUid: this.selectedStudentUid || null,
      studentEmail: this.users.find(u => u.uid === this.selectedStudentUid)?.email || null,
      timeSlot: `${this.editingSlot.date.getHours()}:00`,
      teacherId: currentUid,
      classDate: this.editingSlot.date
    };
    console.log('assignClass: creating with', { currentUid, authUid: auth.currentUser?.uid, newClass });
    try {
  const res = await this.calendarService.addClass(newClass as any);
  console.log('assignClass: created class id', res?.id || res);
  this.editingSlot = null;
  this.loadData();
    } catch (err) {
      console.error('assignClass error', err);
    }
  }
}