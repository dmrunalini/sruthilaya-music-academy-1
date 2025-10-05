import { Component, OnInit } from '@angular/core';
import { PushNotificationsService } from '../services/push-notifications.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications: string[] = [];

  constructor(private pushNotificationsService: PushNotificationsService) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.pushNotificationsService.getNotifications().subscribe((data: string[]) => {
      this.notifications = data;
    });
  }
}