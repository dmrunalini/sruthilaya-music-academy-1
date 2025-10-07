import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NavbarComponent {
  private sub: Subscription | null = null;
  homeLink = '/welcome';

  constructor(private authService: AuthService) {
    // initialize from cached profile if available
    const user = this.authService.getUserData();
    this.homeLink = user?.role === 'teacher' ? '/calendar' : (user?.role === 'student' ? '/classes' : '/login');

    // react to changes in auth/profile
    this.sub = this.authService.user$.subscribe(u => {
      if (!u) {
        this.homeLink = '/welcome';
      } else if (u.role === 'teacher') {
        this.homeLink = '/calendar';
      } else if (u.role === 'student') {
        this.homeLink = '/classes';
      } else {
        this.homeLink = '/welcome';
      }
    });
  }

  isLoggedIn() {
    return this.authService.isLoggedIn();
  }

  logout() {
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}