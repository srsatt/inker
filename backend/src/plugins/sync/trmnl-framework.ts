import * as fs from 'fs';
import * as path from 'path';
import { TRMNL_CSS } from './trmnl-css';

const FRAMEWORK_CSS_PATHS = [
  path.join(__dirname, 'trmnl-framework-3.1.1.min.css'),
  path.join(process.cwd(), 'src', 'plugins', 'sync', 'trmnl-framework-3.1.1.min.css'),
];

let cachedCss: string | null = null;

export function getTrmnlFrameworkCss(): string {
  if (cachedCss !== null) return cachedCss;

  for (const cssPath of FRAMEWORK_CSS_PATHS) {
    if (fs.existsSync(cssPath)) {
      cachedCss = fs.readFileSync(cssPath, 'utf8');
      return cachedCss;
    }
  }

  cachedCss = TRMNL_CSS;
  return cachedCss;
}
