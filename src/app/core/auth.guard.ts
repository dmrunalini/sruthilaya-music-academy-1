import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean | UrlTree {
    const isAuthenticated = this.authService.isLoggedIn();
    if (!isAuthenticated) {
      // return a UrlTree instead of navigating directly to prevent the target route from initializing
      return this.router.createUrlTree(['/login']);
    }
    return true;
  }
}