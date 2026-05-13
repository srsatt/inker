export interface SatoriLintIssue {
  path: string;
  message: string;
}

const ALLOWED_MULTI_CHILD_DISPLAY = new Set(['flex', 'contents', 'none']);

export function lintSatoriNode(node: any): SatoriLintIssue[] {
  const issues: SatoriLintIssue[] = [];
  visit(node, 'root', issues);
  return issues;
}

export function formatSatoriLintIssues(issues: SatoriLintIssue[]): string {
  return issues.map(issue => `${issue.path}: ${issue.message}`).join('\n');
}

function visit(node: any, path: string, issues: SatoriLintIssue[]): void {
  if (node === null || node === undefined || typeof node !== 'object') return;

  const type = String(node.type || 'unknown');
  const props = node.props || {};
  const children = normalizeChildren(props.children);

  if (type === 'div' && children.length > 0 && !hasExplicitDisplay(props.style)) {
    issues.push({
      path,
      message: '<div> with children must set display:flex, display:contents, or display:none',
    });
  }

  children.forEach((child, index) => visit(child, `${path}.${type}[${index}]`, issues));
}

function normalizeChildren(children: any): any[] {
  if (children === null || children === undefined || children === '') return [];
  return Array.isArray(children) ? children : [children];
}

function hasExplicitDisplay(style: any): boolean {
  if (!style || typeof style !== 'object') return false;
  const display = style.display;
  return typeof display === 'string' && ALLOWED_MULTI_CHILD_DISPLAY.has(display);
}
