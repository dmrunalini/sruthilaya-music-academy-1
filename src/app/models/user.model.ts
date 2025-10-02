export interface User {
  id?: string; // Optional ID for Firestore document
  name: string;
  phoneNumber: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  teamsLink?: string; // Optional link to teams or groups
  role: 'teacher' | 'student'; // Role to differentiate between teachers and students
}