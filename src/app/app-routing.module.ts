import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { ClassListComponent } from './classes/class-list/class-list.component';
import { ClassDetailComponent } from './classes/class-detail/class-detail.component';
import { CalendarComponent } from './calendar/calendar.component';
import { MaterialsMenuComponent } from './materials/materials-menu/materials-menu.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { AuthGuard } from './core/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'classes', component: ClassListComponent, canActivate: [AuthGuard] },
  { path: 'classes/:id', component: ClassDetailComponent, canActivate: [AuthGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard] },
  { path: 'materials', component: MaterialsMenuComponent, canActivate: [AuthGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }