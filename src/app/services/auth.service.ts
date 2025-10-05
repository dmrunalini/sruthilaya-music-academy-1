import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

// Lightweight in-memory AuthService stub for local development.
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private users = new Map<string, { password: string; details: User }>();
  userData: User | null = null;

  constructor(private router: Router) {}

  async signup(email: string, password: string, userDetails: User): Promise<void> {
    console.log('[AuthService] signup called', { email, userDetails });
    if (this.users.has(email)) {
      console.warn('[AuthService] signup failed: user exists', email);
      throw new Error('User already exists');
    }
    this.users.set(email, { password, details: userDetails });
    this.userData = { ...userDetails, uid: email } as User;
    console.log('[AuthService] signup completed for', email);
  }

  async login(email: string, password: string): Promise<void> {
    const u = this.users.get(email);
    if (!u || u.password !== password) {
      throw new Error('Invalid credentials');
    }
    this.userData = { ...u.details, uid: email } as User;
  }

  async logout(): Promise<void> {
    this.userData = null;
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.userData !== null;
  }

  getUserData(): User | null {
    return this.userData;
  }
}