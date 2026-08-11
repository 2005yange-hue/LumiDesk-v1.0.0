export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    timestamp: string;
}
export interface PaginationDto {
    page: number;
    pageSize: number;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
export interface RuntimeModelConfig {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
}
