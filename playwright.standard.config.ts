import { defineConfig } from '@playwright/test';
import base, { LONG_SPECS } from './playwright.config';

// Everything except the long flight and catalog specs (about 1.8 h at 3 workers).
export default defineConfig({ ...base, testIgnore: LONG_SPECS });
