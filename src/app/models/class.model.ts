export interface Class {
    id: string;
    studentName: string;
    timeSlot: string;
    teacherId: string;
    classDate: Date;
    // subject removed/optional — keep for backward compatibility
    subject?: string;
    // legacy name field (optional)
    name?: string;
}