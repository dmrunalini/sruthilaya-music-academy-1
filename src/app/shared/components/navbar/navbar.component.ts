import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NavbarComponent implements OnDestroy {
  private sub: Subscription | null = null;
  homeLink = '/welcome';
  currentUser: User | null = null;

  constructor(private authService: AuthService) {
    // initialize from cached profile if available
    this.currentUser = this.authService.getUserData();
    this.updateHomeLink();

    // react to changes in auth/profile
    this.sub = this.authService.user$.subscribe(user => {
      this.currentUser = user || null;
      this.updateHomeLink();
    });
  }

  private updateHomeLink(): void {
    if (!this.currentUser) {
      this.homeLink = '/welcome';
    } else if (this.currentUser.role === 'teacher') {
      this.homeLink = '/calendar';
    } else if (this.currentUser.role === 'student') {
      this.homeLink = '/classes';
    } else {
      this.homeLink = '/welcome';
    }
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  isTeacher(): boolean {
    return !!(this.currentUser && this.currentUser.role === 'teacher');
  }

  logout() {
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}