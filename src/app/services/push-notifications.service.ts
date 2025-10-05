import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationsService {
  constructor() {}

  // Simple stub: returns an empty notifications array and no-op permission.
  requestPermission(): Observable<null> {
    return of(null);
  }

  receiveMessage(): Observable<any> {
    return of(null);
  }

  getNotifications(): Observable<string[]> {
    return of([]);
  }
}