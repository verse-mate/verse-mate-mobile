/**
 * Bible API Client Configuration
 *
 * Axios instance configured for VerseMate Bible API
 */

import axios from 'axios';

/**
 * Base URL for Bible API
 * @see https://api.verse-mate.apegro.dev/swagger/json
 */
export const BIBLE_API_BASE_URL = 'https://api.verse-mate.apegro.dev';

/**
 * Axios instance for Bible API requests
 */
export const bibleApiClient = axios.create({
  baseURL: BIBLE_API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Request interceptor
 * Add auth tokens, logging, etc.
 */
bibleApiClient.interceptors.request.use(
  (config) => {
    // TODO: Add auth token if needed
    // const token = await getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handle errors, transform responses, etc.
 */
bibleApiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      if (status === 401) {
        // Unauthorized - redirect to login or refresh token
        console.error('Unauthorized request to Bible API');
      } else if (status === 404) {
        // Not found
        console.error('Bible API resource not found:', error.config.url);
      } else if (status >= 500) {
        // Server error
        console.error('Bible API server error:', status, data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Bible API no response:', error.message);
    } else {
      // Error in request configuration
      console.error('Bible API request error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default bibleApiClient;
