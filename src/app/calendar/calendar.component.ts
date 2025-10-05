import { Component, OnInit } from '@angular/core';
import { CalendarService } from '../services/calendar.service';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  schedule: any[] = [];

  constructor(private calendarService: CalendarService) {}

  ngOnInit(): void {
    this.loadSchedule();
  }

  loadSchedule(): void {
    this.calendarService.getClasses().subscribe(data => {
      this.schedule = data as any[];
    });
  }
}