export interface Material {
    id: string;
    title: string;
    description: string;
    type: string; // e.g., 'video', 'audio', 'document'
    url: string; // link to the material
    createdAt: Date;
    updatedAt: Date;
}