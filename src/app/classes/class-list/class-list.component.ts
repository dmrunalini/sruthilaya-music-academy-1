import { Component, OnInit } from '@angular/core';
import { FirestoreService } from '../../services/firestore.service';
import { Class } from '../../models/class.model';

@Component({
  selector: 'app-class-list',
  templateUrl: './class-list.component.html',
  styleUrls: ['./class-list.component.scss']
})
export class ClassListComponent implements OnInit {
  classes: Class[] = [];

  constructor(private firestoreService: FirestoreService) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(): void {
    this.firestoreService.getClasses().subscribe((data: Class[]) => {
      this.classes = data;
    });
  }
}