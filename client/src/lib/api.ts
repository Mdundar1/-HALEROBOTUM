import axios from 'axios';

const API_URL = '/api';

// Create instance with interceptor
const axiosInstance = axios.create({
    baseURL: API_URL
});

axiosInstance.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const api = {
    // Dataset Management
    uploadDataset: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axiosInstance.post(`/dataset/upload`, formData);
        return response.data;
    },

    getDataset: async () => {
        const response = await axiosInstance.get(`/dataset`);
        return response.data;
    },

    clearDataset: async () => {
        const response = await axiosInstance.delete(`/dataset`);
        return response.data;
    },

    // Cost Estimation
    matchFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axiosInstance.post(`/match`, formData);
        return response.data;
    },

    // Legacy / General Upload
    uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axiosInstance.post(`/upload`, formData);
        return response.data;
    }
};
