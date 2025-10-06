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
  hours = [9, 10, 11, 12, 13, 14, 15, 16];
  slots: Slot[][] = [];
  classes: any[] = [];
  users: any[] = [];
  isTeacher = false;
  editingSlot: Slot | null = null;
  selectedStudentUid = '';
  selectedSubject = '';

  constructor(private calendarService: CalendarService, private firestore: FirestoreService, private auth: AuthService) {}

  ngOnInit(): void {
    // build next 7 days
    console.log('CalendarComponent: ngOnInit');
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      this.days.push(d);
    }
    this.buildSlots();
    this.loadData();
    const user = this.auth.getUserData();
    this.isTeacher = !!(user && user.role === 'teacher');
    this.auth.user$.subscribe(u => this.isTeacher = !!(u && u.role === 'teacher'));
  }

  buildSlots() {
    this.slots = this.hours.map(h => {
      return this.days.map(d => ({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h) }));
    });
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
    this.selectedSubject = '';
  }

  async assignClass() {
    if (!this.editingSlot) return;
    const teacher = this.auth.getUserData();
    // Prefer the real Firebase auth UID to ensure it matches the security rules
    const currentUid = auth.currentUser?.uid || teacher?.uid || '';
    const newClass: any = {
      studentName: this.users.find(u => u.uid === this.selectedStudentUid)?.name || '',
      subject: this.selectedSubject || 'Lesson',
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