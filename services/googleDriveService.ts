
import { DriveFile } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const listDriveFiles = async (accessToken: string, query: string = "trashed = false"): Promise<{ success: boolean; files?: DriveFile[]; message?: string }> => {
    try {
        const response = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)&pageSize=10`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
             if (error.error.code === 401) {
                return { success: false, message: 'UNAUTHENTICATED' };
            }
            throw new Error(error.error.message);
        }

        const data = await response.json();
        return { success: true, files: data.files };
    } catch (error: any) {
        console.error("List Drive Files Error:", error);
        return { success: false, message: error.message || "Failed to fetch files." };
    }
};

export const createDriveFile = async (accessToken: string, fileName: string, content: string, mimeType: string = 'text/plain'): Promise<{ success: boolean; fileId?: string; webViewLink?: string; message?: string }> => {
    try {
        const metadata = {
            name: fileName,
            mimeType: mimeType
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: mimeType }));

        const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,webViewLink`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: form
        });

        if (!response.ok) {
             const error = await response.json();
             if (error.error.code === 401) {
                return { success: false, message: 'UNAUTHENTICATED' };
            }
            throw new Error(error.error.message);
        }

        const data = await response.json();
        return { success: true, fileId: data.id, webViewLink: data.webViewLink };
    } catch (error: any) {
        console.error("Create Drive File Error:", error);
        return { success: false, message: error.message || "Failed to create file." };
    }
};

export const readDriveFile = async (accessToken: string, fileId: string): Promise<{ success: boolean; content?: string; message?: string }> => {
    try {
        const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

         if (!response.ok) {
             const error = await response.json();
             if (error.error.code === 401) {
                return { success: false, message: 'UNAUTHENTICATED' };
            }
            throw new Error(error.error.message);
        }

        const content = await response.text();
        return { success: true, content };
    } catch (error: any) {
         console.error("Read Drive File Error:", error);
        return { success: false, message: error.message || "Failed to read file." };
    }
};
