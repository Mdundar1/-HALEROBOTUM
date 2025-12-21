export interface PozItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    unitPrice: number;
}

export interface ProjectItem {
    id: string;
    rawText: string;
    matchedPoz?: PozItem;
    quantity: number;
    calculatedPrice?: number;
    status: 'pending' | 'matched' | 'unmatched';
}

export interface Project {
    id: string;
    name: string;
    items: ProjectItem[];
    totalCost: number;
    createdAt: string;
}

export interface UploadResponse {
    message: string;
    key: string;
    fileId?: string;
}

export interface OCRResult {
    text: string;
    confidence: number;
}

export interface OCRResponse {
    status: 'success' | 'error';
    data?: OCRResult[];
    message?: string;
}
