import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseUser, sendPasswordResetEmail as fbSendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword as fbUpdatePassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userData: User | null = null;
  private userSubject = new BehaviorSubject<User | null | undefined>(undefined);
  user$: Observable<User | null | undefined> = this.userSubject.asObservable();
  private authInitialized = false;

  constructor(private router: Router, private firestoreService: FirestoreService) {
    // Listen to auth state changes and load Firestore profile (to get role)
    auth.onAuthStateChanged((u: FirebaseUser | null) => {
      this.authInitialized = true;
      if (u) {
        // load profile from Firestore
        this.firestoreService.getUser(u.uid).subscribe(profile => {
          if (profile) {
            this.userData = { ...profile, uid: u.uid, email: u.email } as User;
          } else {
            this.userData = { uid: u.uid, email: u.email } as User;
          }
          this.userSubject.next(this.userData);
        });
      } else {
        this.userData = null;
        this.userSubject.next(null);
      }
    });
  }

  // Send a password reset email to the given address (Firebase handles the email)
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await fbSendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Auth: sendPasswordReset error', err);
      throw err;
    }
  }

  // Reauthenticate current user with their current password and update to a new password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const current = auth.currentUser;
    if (!current || !current.email) {
      throw new Error('No authenticated user');
    }
    try {
      const cred = EmailAuthProvider.credential(current.email, oldPassword);
      await reauthenticateWithCredential(current, cred);
      await fbUpdatePassword(current, newPassword);
    } catch (err: any) {
      // Map common Firebase errors to friendly messages that can be shown inline
      const code = err?.code || err?.message || '';
      let message = 'Failed to change password';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        message = 'Current password is incorrect';
      } else if (code === 'auth/weak-password') {
        message = 'The new password is too weak';
      } else if (typeof err?.message === 'string' && err.message) {
        message = err.message;
      }
      throw new Error(message);
    }
  }

  async signup(email: string, password: string, userDetails: User): Promise<void> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    this.userData = { ...userDetails, uid, email } as User;
    // Persist profile in Firestore with defensive logging for debugging permission / network errors
    try {
      await setDoc(doc(db, 'users', uid), this.userData as any);
      console.log('Firestore: successfully wrote user profile', { uid, user: this.userData });
      this.userSubject.next(this.userData);
    } catch (err: any) {
      // Log useful parts of the Firebase error for debugging in the browser console
      console.error('Firestore: error writing user profile', {
        uid,
        user: this.userData,
        name: err?.name,
        code: err?.code,
        message: err?.message,
        stack: err?.stack
      });
      throw err;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will update userData
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.router.navigate(['/login']);
    this.userData = null;
    this.userSubject.next(null);
  }

  isLoggedIn(): boolean {
    // Consider the user logged in if we have a cached profile or if Firebase reports a currentUser
    return this.userData !== null || !!auth.currentUser;
  }

  isInitialized(): boolean {
    return this.authInitialized;
  }

  getUserData(): User | null {
    return this.userData;
  }

  /**
   * Manually merge and broadcast updated user fields (e.g. after profile save)
   */
  updateCachedUser(patch: Partial<User>) {
    if (!this.userData) return;
    this.userData = { ...this.userData, ...patch } as User;
    this.userSubject.next(this.userData);
  }
}