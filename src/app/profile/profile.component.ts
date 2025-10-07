import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styleUrls: ['./profile.component.scss'],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private phonePattern = /^[0-9+()\-\s]{6,20}$/;
  private urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/\S*)?$/i;

  form = this.fb.group({
    name: ['', Validators.required],
    countryCode: ['+91', Validators.required],
    phone: ['', [Validators.pattern(this.phonePattern)]],
    age: ['', [Validators.min(5), Validators.max(120)]],
    gender: [''],
    teamsLink: ['', Validators.pattern(this.urlPattern)]
  });

  pwform = this.fb.group({
    oldPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  pwModalOpen = false;
  message = '';
  error = '';
  private uid?: string;

  constructor(private fb: FormBuilder, private firestore: FirestoreService, private auth: AuthService) {
    const user = this.auth.getUserData();
    if (user) {
      this.uid = user.uid;
      this.form.patchValue({
        name: user.name || '',
        countryCode: (user as any).countryCode || '+91',
        phone: user.phone || '',
        age: user.age != null ? String(user.age) : '',
        gender: user.gender || '',
        teamsLink: (user as any).teamsLink || ''
      });
    }
  }

  async save() {
    this.message = '';
    this.error = '';
    if (!this.uid) { this.error = 'No user available'; return; }
    if (!this.form.valid) { this.error = 'Fix validation errors before saving'; return; }
    try {
      const updated = { ...(this.form.value as any) };
      Object.keys(updated).forEach(k => { if (updated[k] === '') delete updated[k]; });
      await firstValueFrom(this.firestore.updateUser(this.uid, updated as any));
      this.message = 'Profile saved.';
    } catch (err: any) {
      this.error = err?.message || 'Failed to save profile';
    }
  }

  async changePassword() {
    this.message = '';
    this.error = '';
    if (!this.pwform.valid) { this.error = 'Please fill password fields'; return; }
    const { oldPassword, newPassword, confirmPassword } = this.pwform.value as any;
    if (newPassword !== confirmPassword) { this.error = 'New password and confirmation do not match'; return; }
    try {
      await this.auth.changePassword(oldPassword as string, newPassword as string);
      this.message = 'Password updated successfully';
      this.pwform.reset();
      this.pwModalOpen = false;
    } catch (err: any) {
      this.error = err?.message || 'Failed to change password';
    }
  }
}
