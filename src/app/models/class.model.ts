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
    // timezone information
    timezone?: string; // The timezone in which the class was created
    utcDate?: Date; // UTC version of the class date for consistent storage
}