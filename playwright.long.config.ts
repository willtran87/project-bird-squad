import { defineConfig } from '@playwright/test';
import base, { LONG_SPECS } from './playwright.config';

// Only the long flight and catalog specs (about 50 min at 3 workers).
export default defineConfig({ ...base, testMatch: LONG_SPECS });
