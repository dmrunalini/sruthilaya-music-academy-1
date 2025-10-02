import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { PushNotificationsService } from '../services/push-notifications.service';
import { CalendarService } from '../services/calendar.service';
import { AuthGuard } from './auth.guard';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    AuthService,
    FirestoreService,
    PushNotificationsService,
    CalendarService,
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class CoreModule { }