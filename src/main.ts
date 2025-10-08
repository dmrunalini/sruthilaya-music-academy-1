import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { AuthGuard } from './app/core/auth.guard';
import { environment } from './environments/environment';

import type { Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/welcome', pathMatch: 'full' },
  { path: 'welcome', loadComponent: () => import('./app/welcome/welcome.component').then(m => m.WelcomeComponent) },
  { path: 'login', loadComponent: () => import('./app/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'signup', loadComponent: () => import('./app/auth/signup/signup.component').then(m => m.SignupComponent) },
  { path: 'classes', loadComponent: () => import('./app/classes/class-list/class-list.component').then(m => m.ClassListComponent), canActivate: [AuthGuard] },
  { path: 'classes/:id', loadComponent: () => import('./app/classes/class-detail/class-detail.component').then(m => m.ClassDetailComponent), canActivate: [AuthGuard] },
  { path: 'calendar', loadComponent: () => import('./app/calendar/calendar.component').then(m => m.CalendarComponent), canActivate: [AuthGuard] },
  { path: 'materials', loadComponent: () => import('./app/materials/materials-menu/materials-menu.component').then(m => m.MaterialsMenuComponent), canActivate: [AuthGuard] },
  { path: 'students', loadComponent: () => import('./app/students/students.component').then(m => m.StudentsComponent), canActivate: [AuthGuard] },
  { path: 'notifications', loadComponent: () => import('./app/notifications/notifications.component').then(m => m.NotificationsComponent) }
  ,
  { path: 'password-reset', loadComponent: () => import('./app/auth/password-reset/password-reset.component').then(m => m.PasswordResetComponent) },
  { path: 'profile', loadComponent: () => import('./app/profile/profile.component').then(m => m.ProfileComponent), canActivate: [AuthGuard] }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes)
  ]
}).catch(err => console.error(err));
