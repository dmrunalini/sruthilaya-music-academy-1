export class ClassDetailComponent {
  classId: string;
  classDetails: any;

  constructor(private firestoreService: FirestoreService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.classId = this.route.snapshot.paramMap.get('id');
    this.getClassDetails();
  }

  getClassDetails() {
    this.firestoreService.getClassById(this.classId).subscribe(data => {
      this.classDetails = data;
    });
  }
}