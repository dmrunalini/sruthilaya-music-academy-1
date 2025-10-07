export interface Material {
    id: string;
    title: string;
    description?: string;
    category?: string; // category/folder name
    type?: string; // e.g., 'document', 'image', 'text'
    // For uploaded files we store simple metadata; actual storage could be Cloud Storage later
    fileName?: string;
    fileType?: string;
    fileBase64?: string; // small-files only; consider switching to Cloud Storage for larger files
    content?: string; // plain text content for word-pad style notes
    ownerUid?: string; // who created the material
    createdAt?: Date;
    updatedAt?: Date;
}