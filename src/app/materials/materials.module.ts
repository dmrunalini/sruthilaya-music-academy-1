import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsMenuComponent } from './materials-menu/materials-menu.component';

@NgModule({
  declarations: [MaterialsMenuComponent],
  imports: [
    CommonModule
  ],
  exports: [MaterialsMenuComponent]
})
export class MaterialsModule { }