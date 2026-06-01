import { useEffect, useRef } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import type { FieldMeta } from '../../types';

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#315f3f', fontWeight: 'bold' },
  { tag: tags.string, color: '#6b4f1d' },
  { tag: tags.number, color: '#6b4f1d' },
  { tag: tags.variableName, color: '#1f2937' },
  { tag: tags.propertyName, color: '#4f6f44' },
  { tag: tags.tagName, color: '#315f3f', fontWeight: 'bold' },
  { tag: tags.attributeName, color: '#5f6368' },
  { tag: tags.comment, color: '#8a8a8a', fontStyle: 'italic' },
]);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableFields?: FieldMeta[];
  contextSchema?: Record<string, unknown> | null;
  placeholderText?: string;
  minHeight?: number;
}

function extractContextCompletions(schema: Record<string, unknown> | null | undefined): Completion[] {
  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return [];

  return Object.entries(properties as Record<string, Record<string, unknown>>).map(([name, property]) => ({
    label: `ctx.${name}`,
    type: 'variable',
    detail: typeof property?.type === 'string' ? property.type : 'context',
    info: typeof property?.description === 'string' ? property.description : undefined,
  }));
}

export function CodeEditor({
  value,
  onChange,
  availableFields = [],
  contextSchema,
  placeholderText = '',
  minHeight = 320,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const fieldCompletions: Completion[] = availableFields.map((field) => ({
      label: `$.${field.path}`,
      type: 'variable',
      detail: field.type,
      info: field.isImageUrl ? 'image URL' : field.isLink ? 'link' : undefined,
    }));
    const contextCompletions = extractContextCompletions(contextSchema);
    const completions = [...fieldCompletions, ...contextCompletions];

    const completionSource = (context: CompletionContext) => {
      const word = context.matchBefore(/[\w$.[\]]+/);
      if (!word) return null;
      return {
        from: word.from,
        options: completions.filter((completion) =>
          completion.label.toLowerCase().includes(word.text.toLowerCase())
        ),
        validFor: /^[\w$.[\]]*$/,
      };
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        syntaxHighlighting(highlightStyle),
        javascript({ jsx: true, typescript: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        autocompletion({ override: [completionSource], activateOnTyping: true }),
        placeholder(placeholderText),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': {
            minHeight: `${minHeight}px`,
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#1f2937',
          },
          '.cm-scroller': {
            minHeight: `${minHeight}px`,
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': {
            padding: '12px 0',
          },
          '.cm-gutters': {
            backgroundColor: '#f5f5f4',
            color: '#78716c',
            borderRight: '1px solid #d6d3d1',
          },
          '.cm-activeLine, .cm-activeLineGutter': {
            backgroundColor: '#eef3ea',
          },
          '&.cm-focused': {
            outline: '2px solid #4f6f44',
          },
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  // Initialize once. Field completions refresh on remount when the form source changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;
    view.dispatch({ changes: { from: 0, to: currentValue.length, insert: value } });
  }, [value]);

  return (
    <div className="border border-border-default rounded-lg overflow-hidden bg-bg-card">
      <div ref={editorRef} />
    </div>
  );
}
