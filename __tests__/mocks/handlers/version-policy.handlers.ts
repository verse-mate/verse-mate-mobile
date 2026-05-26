import { HttpResponse, http } from 'msw';

const API_BASE_URL = 'http://localhost:4000';

export const defaultVersionPolicyResponse = {
  minVersion: '0.0.0',
  version: '0.0.0',
  releaseNotes: '',
};

export const versionPolicyHandlers = [
  http.get(`${API_BASE_URL}/api/version-policy`, () =>
    HttpResponse.json(defaultVersionPolicyResponse)
  ),
];
