# Sruthilaya Music Academy

## Overview
Sruthilaya Music Academy is an Angular-based web application designed to facilitate music education for students and teachers. The application includes features for user authentication, class management, a calendar view, push notifications, and a materials menu.

## Features
- **User Authentication**: Signup and login functionality for both teachers and students.
- **Class Management**: Ability to view and manage classes, including details and schedules.
- **Calendar View**: A weekly calendar to display class schedules and availability.
- **Push Notifications**: Notifications for students regarding class updates and announcements.
- **Materials Menu**: Access to teaching materials for both students and teachers.

## Technologies Used
- Angular
- Firebase Firestore for database management
- Angular Material for UI components

## Project Structure
```
sruthilaya-music-academy-1
├── src
│   ├── app
│   │   ├── core
│   │   ├── services
│   │   ├── models
│   │   ├── auth
│   │   ├── classes
│   │   ├── calendar
│   │   ├── materials
│   │   ├── notifications
│   │   ├── shared
│   │   ├── app-routing.module.ts
│   │   └── app.component.ts
│   ├── assets
│   ├── environments
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json
├── package.json
├── tsconfig.json
├── tslint.json
└── README.md
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd sruthilaya-music-academy-1
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Configure Firebase Firestore settings in `src/environments/environment.ts`.
5. Run the application:
   ```
   ng serve
   ```
6. Open your browser and navigate to `http://localhost:4200`.

## Contribution
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.