import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { take, filter } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      try {
        const { email, password } = this.loginForm.value;
        await this.authService.login(email, password);
        // Wait until the profile is loaded from Firestore (auth.user$ emits a non-null value)
        this.authService.user$.pipe(filter(u => u !== null), take(1)).subscribe(user => {
          const isTeacher = !!(user && user.role === 'teacher');
          console.log('Login redirect: user profile loaded', user, 'isTeacher=', isTeacher);
          this.router.navigate([isTeacher ? '/calendar' : '/classes']);
        });
      } catch (error: any) {
        this.errorMessage = error?.message || 'Login failed';
      }
    }
  }
}