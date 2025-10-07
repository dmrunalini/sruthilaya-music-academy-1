import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="welcome">
      <h1>Welcome to Sruthilaya Music Academy</h1>
      <p>If you'd like to explore, please sign up or log in. If you prefer, you can continue browsing the public pages.</p>
    </div>
  `
})
export class WelcomeComponent {}
