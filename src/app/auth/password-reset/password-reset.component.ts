import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="password-reset">
      <h2>Reset password</h2>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <label>Email</label>
        <input formControlName="email" />
        <button type="submit">Send reset email</button>
      </form>
      <div *ngIf="message" class="message">{{ message }}</div>
      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `
})
export class PasswordResetComponent {
  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  message = '';
  error = '';

  constructor(private fb: FormBuilder, private auth: AuthService) {}

  async onSubmit() {
    this.message = '';
    this.error = '';
    if (this.form.valid) {
      try {
        const email = this.form.value.email as string;
        await this.auth.sendPasswordReset(email);
        this.message = 'Password reset email sent. Check your inbox.';
      } catch (err: any) {
        this.error = err?.message || 'Failed to send reset email';
      }
    }
  }
}
