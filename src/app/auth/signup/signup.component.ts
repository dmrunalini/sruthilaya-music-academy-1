import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class SignupComponent {
  signupForm: FormGroup;
  errorMessage = '';
  isSubmitting = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.signupForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', Validators.required],
      age: ['', Validators.required],
      gender: ['', Validators.required],
      role: ['student', Validators.required],
      teamsLink: ['']
    });
  }

  async onSubmit() {
    console.log('Signup onSubmit called', { valid: this.signupForm.valid, value: this.signupForm.value });
    this.errorMessage = '';
    if (this.signupForm.valid) {
      this.isSubmitting = true;
      try {
  const { name, email, password, phone, age, gender, teamsLink, role } = this.signupForm.value;
  console.log('Calling AuthService.signup with', { email, password, details: { name, email, phone, age, gender, teamsLink, role } });
  await this.authService.signup(email, password, { name, email, phone, age, gender, teamsLink, role } as any);
  console.log('Signup successful for', email);
  this.router.navigate(['/classes']);
      } catch (err: any) {
        console.error('Signup error', err);
        this.errorMessage = err?.message || 'Signup failed';
      } finally {
        this.isSubmitting = false;
      }
    } else {
      console.warn('Signup form invalid', this.signupForm.errors);
      // Detailed diagnostics for each control
      Object.keys(this.signupForm.controls).forEach(key => {
        const control = this.signupForm.get(key);
        console.log(`control: ${key}`, {
          value: control?.value,
          valid: control?.valid,
          touched: control?.touched,
          dirty: control?.dirty,
          errors: control?.errors
        });
      });
      this.errorMessage = 'Please fill all required fields correctly.';
    }
  }
}