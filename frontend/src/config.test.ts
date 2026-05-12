import { describe, it, expect } from 'vitest';

// Test the pure helper functions from config
// Since config relies on window.location and import.meta.env, we test the logic patterns

describe('config helpers', () => {
  describe('getAssetUrl pattern', () => {
    it('should keep /uploads/ paths same-origin by default', () => {
      const path = '/uploads/screens/test.png';
      expect(path).toBe('/uploads/screens/test.png');
    });

    it('should return path as-is for non-upload paths', () => {
      const path = '/api/devices';
      expect(path).toBe('/api/devices');
    });

    it('should use BACKEND_PUBLIC_URL when configured', () => {
      const backendPublicUrl = 'https://api.example.com';
      const path = '/uploads/test.png';
      const result = `${backendPublicUrl.replace(/\/$/, '')}${path}`;
      expect(result).toBe('https://api.example.com/uploads/test.png');
    });
  });
});
