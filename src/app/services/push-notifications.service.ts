import { Injectable } from '@angular/core';
import { AngularFireMessaging } from '@angular/fire/messaging';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationsService {
  constructor(private afMessaging: AngularFireMessaging) {}

  requestPermission(): Observable<any> {
    return this.afMessaging.requestToken.pipe(
      tap(token => {
        console.log('Permission granted! Save to the server!', token);
      })
    );
  }

  receiveMessage(): Observable<any> {
    return this.afMessaging.messages;
  }
}