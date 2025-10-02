import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userData: User | null = null;

  constructor(private afAuth: AngularFireAuth, private router: Router) {
    this.afAuth.authState.subscribe(user => {
      this.userData = user ? user : null;
    });
  }

  async signup(email: string, password: string, userDetails: User): Promise<void> {
    const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);
    this.userData = { ...userDetails, uid: userCredential.user?.uid };
    // Save user data to Firestore or any other database
  }

  async login(email: string, password: string): Promise<void> {
    await this.afAuth.signInWithEmailAndPassword(email, password);
    this.router.navigate(['/dashboard']); // Redirect to dashboard or home page
  }

  async logout(): Promise<void> {
    await this.afAuth.signOut();
    this.router.navigate(['/login']); // Redirect to login page
  }

  isLoggedIn(): boolean {
    return this.userData !== null;
  }

  getUserData(): User | null {
    return this.userData;
  }
}