import { useRef, useState, type CSSProperties } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { Task } from '../../types';
import { Card } from '../shared/Card';
import { MarkdownLabel } from '../shared/MarkdownLabel';

const TASK_ROW_HEIGHT = 48;

export function TasksCard({
  theme,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  primary = false,
  expanded = false,
  style,
}: {
  primary?: boolean;
  expanded?: boolean;
  theme: Theme;
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  style?: CSSProperties;
}) {
  const isEmpty = tasks.length === 0;
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  const openComposer = () => {
    setIsAdding(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeComposer = () => {
    setIsAdding(false);
    onNewTaskChange('');
  };

  const submit = () => {
    onAddTask();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Card
      theme={ink}
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(expanded ? { paddingTop: 28, paddingBottom: 28 } : {}),
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 32 }}>
        {!isAdding ? (
          <button
            type="button"
            onClick={openComposer}
            aria-label="Add task"
            style={{
              width: 32,
              height: 32,
              borderRadius: Radius.md,
              border: `1px solid ${ink.border}`,
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
          </button>
        ) : null}
      </div>

      {isEmpty ? (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: TASK_ROW_HEIGHT,
              borderBottom: `1px solid ${ink.border}`,
              opacity: 0.6,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: Radius.full,
                border: `2px solid ${ink.border}`,
                flexShrink: 0,
              }}
            />
            <span style={{ ...Typography.app.caption, color: ink.textMuted }}>No tasks scheduled.</span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8, maxHeight: 192, overflowY: 'auto' }}>
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              role="checkbox"
              aria-checked={task.done}
              onClick={() => onToggleTask(task.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                height: TASK_ROW_HEIGHT,
                border: 'none',
                borderBottom: `1px solid ${ink.border}`,
                backgroundColor: 'transparent',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: Radius.full,
                  border: `2px solid ${task.done ? theme.accent : ink.border}`,
                  backgroundColor: task.done ? theme.accent : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {task.done ? <Check size={14} color={theme.accentText} /> : null}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <MarkdownLabel
                  theme={ink}
                  value={task.label}
                  style={{
                    ...Typography.app.bodyStrong,
                    color: task.done ? ink.textMuted : ink.text,
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      {isAdding ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 48,
            marginTop: 12,
            border: `1px solid ${theme.border}`,
            borderRadius: Radius.input,
            backgroundColor: theme.background,
            padding: '0 12px',
            gap: 8,
          }}
        >
          <Plus size={16} color={theme.textMuted} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={newTask}
            onChange={(e) => onNewTaskChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') closeComposer();
            }}
            onBlur={() => {
              if (!newTask.trim()) closeComposer();
            }}
            placeholder="What needs doing?"
            aria-label="New task"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.text,
              outline: 'none',
              ...Typography.app.body,
            }}
          />
          <button
            type="button"
            onClick={submit}
            aria-label="Save task"
            style={{
              width: 28,
              height: 28,
              borderRadius: Radius.sm,
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={closeComposer}
            aria-label="Cancel"
            style={{
              width: 28,
              height: 28,
              borderRadius: Radius.sm,
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </Card>
  );
}
