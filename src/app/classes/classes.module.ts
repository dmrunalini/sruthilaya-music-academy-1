import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClassListComponent } from './class-list/class-list.component';
import { ClassDetailComponent } from './class-detail/class-detail.component';

@NgModule({
  declarations: [
    ClassListComponent,
    ClassDetailComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ClassListComponent,
    ClassDetailComponent
  ]
})
export class ClassesModule { }