import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../services/firestore.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-class-detail',
  templateUrl: './class-detail.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class ClassDetailComponent implements OnInit {
  classId = '';
  classDetails: any;

  constructor(private firestoreService: FirestoreService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.classId = this.route.snapshot.paramMap.get('id') || '';
    this.getClassDetails();
  }

  getClassDetails() {
    this.firestoreService.getClass(this.classId).subscribe(data => {
      this.classDetails = data;
    });
  }
}