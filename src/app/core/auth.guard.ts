import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, timeout, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    
    return new Observable<boolean | UrlTree>(observer => {
      // First check if auth service is initialized and has a current user
      if (this.authService.isInitialized()) {
        const user = this.authService.getUserData();
        if (user) {
          observer.next(true);
          observer.complete();
          return;
        } else {
          observer.next(this.router.createUrlTree(['/login']));
          observer.complete();
          return;
        }
      }
      
      // If not initialized, wait for the user$ stream to provide definitive state
      const subscription = this.authService.user$.pipe(
        filter(() => this.authService.isInitialized()), // Only proceed when auth is initialized
        take(1)
      ).subscribe({
        next: (user) => {
          if (user) {
            observer.next(true);
          } else {
            observer.next(this.router.createUrlTree(['/login']));
          }
          observer.complete();
        },
        error: (error) => {
          console.error('Auth guard error:', error);
          observer.next(this.router.createUrlTree(['/login']));
          observer.complete();
        }
      });
      
      // Timeout after 10 seconds to prevent infinite waiting
      setTimeout(() => {
        if (!observer.closed) {
          console.warn('Auth guard timeout - redirecting to login');
          observer.next(this.router.createUrlTree(['/login']));
          observer.complete();
          subscription.unsubscribe();
        }
      }, 10000);
      
      // Cleanup function
      return () => {
        subscription.unsubscribe();
      };
    });
  }
}