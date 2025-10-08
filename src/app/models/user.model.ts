export interface User {
  uid?: string;
  id?: string; // Optional ID for Firestore document
  name: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  teamsLink?: string; // Optional link to teams or groups
  role?: 'teacher' | 'student'; // Role to differentiate between teachers and students
  timezone?: string; // User's preferred timezone (e.g., 'IST', 'EST', 'Asia/Kolkata')
}