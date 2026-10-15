import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, PanResponder } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Motion, Layout, Radius, Typography, type Theme } from '../../theme';
import { LIST_WIDTH_MAX, LIST_WIDTH_MIN, type Folder } from '../../types';
import type { Note } from '../../types';
import { relativeTime } from '../shared/utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { useInlineRename } from '../../hooks/useInlineRename';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { Editor } from './Editor';
import { NoteTabs } from './NoteTabs';
import type { NoteTab } from './NoteTabs';

/** Shared shape for web context-menu / native long-press anchors. */
interface AnchorEvent {
  preventDefault?: () => void;
  nativeEvent: { pageX: number; pageY: number };
}

/**
 * Apple Notes-style split pane: scrollable note list on the left, gapless
 * markdown editor on the right.
 *
 * On a phone the split is dropped: there is not the width for two panes, and a
 * 280px list beside a cramped editor is the worst of both. One pane fills the
 * screen at a time — the list, then the typing space for the note you tapped —
 * and a horizontal swipe (or the header's back chevron) returns to the list.
 * See the mobile block below for why the width is measured rather than assumed.
 */
/**
 * Width of the collapsed rail that re-opens it.
 *
 * The expanded width is not a constant: it is the persisted, user-draggable
 * `listWidth` passed in from `HomeScreen`, the same way the sidebar's width is.
 */
const RAIL_WIDTH = 48;

/** How far one arrow-key press moves the divider. Matches the sidebar's. */
const KEYBOARD_STEP = 16;

export function NotesView({
  theme,
  notes,
  selected,
  tabs,
  folderLabel,
  listWidth,
  onResizeList,
  onResizeListCommit,
  isMobile,
  isEditorOpen,
  isListCollapsed,
  onSelect,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onStepTab,
  onOpenEditor,
  onCloseEditor,
  onContentChange,
  onDelete,
  onMoveNote,
  onDuplicateNote,
  onDeleteNote,
  onRenameNote,
  onToggleSidebar,
}: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  /** The notes held open, in the order they were opened. */
  tabs: NoteTab[];
    /** The active folder's name, shown as the list pane's heading. */
  folderLabel: string;
  /** The list pane's expanded width, in points. Persisted and user-draggable. */
  listWidth: number;
  /** Called continuously while the divider is dragged. */
  onResizeList: (width: number) => void;
  /** Called once when the drag ends, to persist the width. */
  onResizeListCommit: (width: number) => void;
  /** Below the tablet breakpoint the two panes are shown one at a time. */
  isMobile: boolean;
  /** Mobile only: is the full-screen typing space the visible pane? */
  isEditorOpen: boolean;
  /** Collapsed to the re-open rail. The control itself lives in `TopHeader`. */
  isListCollapsed: boolean;
  onSelect: (n: Note) => void;
  /** Focus an already-open note from the tab strip. */
  onSelectTab: (id: number) => void;
  /** Close a tab; the orchestrator decides what to focus next. */
  onCloseTab: (id: number) => void;
  /** The strip's `+`: open a new note in a new tab. */
  onNewTab: () => void;
  /** Move one tab along the strip. `-1` is back, `+1` is forward. */
  onStepTab: (direction: -1 | 1) => void;
  /** Mobile only: the note was tapped, so the editor takes the screen. */
  onOpenEditor: () => void;
  /** Mobile only: a swipe left the editor and the list takes the screen back. */
  onCloseEditor: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  /** Move the note with this ID to a folder (opens MoveToModal in orchestrator). */
  onMoveNote?: (noteId: number) => void;
  /** Duplicate the note with this ID. */
  onDuplicateNote?: (noteId: number) => void;
  /** Soft-delete the note with this ID. */
  onDeleteNote?: (noteId: number) => void;
  /** Rename the note with this ID, inline in the list row. */
  onRenameNote?: (noteId: number, title: string) => void;
  onToggleSidebar?: () => void;
}) {
  const display = selected;

  /**
   * Collapsing the list hands its width to the editor.
   *
   * The pane is `theme.background`, not `theme.surface`: a raised surface only
   * makes sense for a *card* sitting on the canvas, and the list is a pane, not
   * a card. It used `surface`, which painted a lighter slab down the left of a
   * screen whose every other region is the canvas — the inconsistency that made
   * the Notes screen look like a different app from the Overview.
   *
   * The state is owned by `HomeScreen` because the collapse control lives in
   * `TopHeader`, not here.
   */
  const progress = useSharedValue(isListCollapsed ? 0 : 1);

  useEffect(() => {
    progress.value = withSpring(isListCollapsed ? 0 : 1, Motion.spring.gentle);
  }, [isListCollapsed, progress]);

  const listStyle = useAnimatedStyle(
    () => ({ width: interpolate(progress.value, [0, 1], [RAIL_WIDTH, listWidth]) }),
    [listWidth]
  );
  const listContentStyle = useAnimatedStyle(() => ({ opacity: progress.value }), []);

    /* ---- The draggable divider between the list and the editor ---- */

    /**
     * The same two-phase resize the sidebar uses: live width while dragging, one
     * persisted write on release.
     *
     * The gesture holds the width at grant time and adds the travel rather than
     * tracking `dx` from zero, because the pointer usually grabs the edge slightly
     * away from its exact x — starting from the live width is what makes the pane
     * follow the finger from wherever it was picked up.
     *
     * The callbacks live in a ref so the responder is built once. A rebuilt
     * `PanResponder` mid-drag swaps the responder out from under a finger that is
     * still down, which is the failure `useHorizontalSwipe` documents.
     */
    const [resizing, setResizing] = useState(false);
    const [handleHovered, setHandleHovered] = useState(false);
    const resizeRef = useRef({ width: listWidth, onResize: onResizeList, onCommit: onResizeListCommit });
    resizeRef.current = { width: listWidth, onResize: onResizeList, onCommit: onResizeListCommit };
    const startWidth = useRef(listWidth);

    const clampList = useCallback((width: number) =>
      Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, width)), []);

    const resizePan = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 1,
          // Claimed on capture: the list's ScrollView answers to a drag too, and
          // without capture the first few pixels are lost to whichever child the
          // pointer landed on.
          onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
          onPanResponderGrant: () => {
            startWidth.current = resizeRef.current.width;
            setResizing(true);
          },
          onPanResponderMove: (_e, g) => {
            resizeRef.current.onResize(clampList(startWidth.current + g.dx));
          },
          onPanResponderRelease: () => {
            setResizing(false);
            resizeRef.current.onCommit(resizeRef.current.width);
          },
          onPanResponderTerminate: () => {
            setResizing(false);
            resizeRef.current.onCommit(resizeRef.current.width);
          },
        }),
      [clampList]
    );

    /**
     * Arrow keys, because a drag handle with no keyboard route is a control only
     * some people can reach. Same shape and same reasoning as the sidebar's.
     */
    const nudge = (delta: number) => resizeRef.current.onCommit(clampList(resizeRef.current.width + delta));

    const resizeKeyDown = (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'ArrowLeft') nudge(-KEYBOARD_STEP);
      else if (e.nativeEvent.key === 'ArrowRight') nudge(KEYBOARD_STEP);
    };

    /**
     * Whether either end of the strip is reachable.
     *
     * The step buttons disable rather than wrap: a button that goes back to the
     * last tab when you are on the first does something different depending on
     * where you are standing, which is the "no modes" failure — the control's
     * effect has to be readable off the control.
     */
    const activeIndex = tabs.findIndex((t) => t.id === display?.id);
    const canStepBack = activeIndex > 0;
    const canStepForward = activeIndex > -1 && activeIndex < tabs.length - 1;

  /* ---- Mobile: one pane at a time ---- */

  /**
   * The pane width, measured rather than guessed.
   *
   * The slide is a `translateX`, and a percentage offset would be the obvious way
   * to write it without measuring — but percentages in a transform are not
   * dependable across the native and web renderers, and a pane that slides by
   * the wrong amount parks itself half on screen. `onLayout` gives the real
   * number on both. It is 0 for the first frame, so both panes start hidden and
   * the first slide is a no-op rather than a jump.
   */
  const [paneWidth, setPaneWidth] = useState(0);

  /** 1 = the list is on screen, 0 = the typing space is. */
  const mobileProgress = useSharedValue(1);

  useEffect(() => {
    if (!isMobile) return;
    mobileProgress.value = withSpring(isEditorOpen ? 0 : 1, Motion.spring.gentle);
  }, [isMobile, isEditorOpen, mobileProgress]);

  /**
   * Both panes are absolutely positioned and one screen wide, so the one that is
   * "closed" slides out from under the other instead of resizing it. Resizing a
   * row of two would mean the editor's own text reflowed on every frame of the
   * transition — and a typing surface that shifts under the caret is exactly the
   * thing the collapse-to-a-rail animation on desktop is avoided for.
   */
  const mobileListStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: -interpolate(mobileProgress.value, [0, 1], [paneWidth, 0]) }] }),
    [paneWidth]
  );
  const mobileEditorStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: interpolate(mobileProgress.value, [0, 1], [0, paneWidth]) }] }),
    [paneWidth]
  );

  /**
   * A swipe either way goes back to the notebook.
   *
   * Both directions, not the conventional "swipe right to go back": there is
   * only one level here, so a direction that did nothing would be a gesture the
   * user has to guess the meaning of. `useHorizontalSwipe` decides the axis
   * before it claims the responder, so a vertical drag still scrolls the note
   * rather than being stolen halfway through.
   *
   * The handlers sit on the pane container rather than on the editor's input, so
   * the gesture works anywhere on the typing space — including on the empty
   * space beside a short note.
   */
  const swipe = useHorizontalSwipe({
    enabled: isMobile && isEditorOpen,
    onSwipeLeft: onCloseEditor,
    onSwipeRight: onCloseEditor,
  });

  /* ---- Context menu state ---- */
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);

  const dismissMenu = () => {
    setMenuAnchor(null);
    setMenuNoteId(null);
  };

  /**
   * Shared with the Overview cards, so a note renames the same way wherever it
   * is listed and the commit guard has one implementation.
   */
  const {
    renamingId,
    draftTitle,
    setDraftTitle,
    inputRef: renameInputRef,
    startRename: startRenameRaw,
    cancelRename,
    commitRename,
  } = useInlineRename((id, title) => onRenameNote?.(id, title));

  // The inline field takes over the row, so the menu must be dismissed first.
  const startRename = (note: Note) => {
    dismissMenu();
    startRenameRaw(note);
  };

  /**
   * Built only while a note is targeted, so each action closes over that
   * concrete id.
   *
   * `ContextMenu` runs `onDismiss()` *before* the action's `onPress`, and
   * dismissing clears `menuNoteId`. An action that read `menuNoteId` from
   * component state at press time therefore saw `null` and silently did
   * nothing — the menu closed, no field appeared, and nothing errored.
   * Capturing the id in the closure is the fix; `NotesCardRow` builds its menu
   * the same way for the same reason.
   */
  const noteMenuActions: ContextMenuAction[] =
    menuNoteId === null
      ? []
      : [
          {
            label: 'Rename',
            iconName: 'pencil-outline',
            onPress: () => {
              const note = notes.find((n) => n.id === menuNoteId);
              if (note) startRename(note);
            },
          },
          { label: 'Move to folder', iconName: 'folder-move-outline', onPress: () => onMoveNote?.(menuNoteId) },
          { label: 'Duplicate', iconName: 'content-duplicate', onPress: () => onDuplicateNote?.(menuNoteId) },
          { label: 'Delete', iconName: 'trash-can-outline', onPress: () => onDeleteNote?.(menuNoteId), destructive: true },
        ];

  return (
    <View
      style={[styles.view, isMobile ? styles.viewMobile : null]}
      onLayout={isMobile ? (e) => setPaneWidth(e.nativeEvent.layout.width) : undefined}
      {...(isMobile ? swipe.panHandlers : {})}
    >
      {/*
        The tab strip spans the full width at the top of the screen, above both
        panes — the Notes screen's top bar now that the header is gone.
      */}
      <NoteTabs
        theme={theme}
        tabs={tabs}
        activeId={display?.id ?? null}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        onNewTab={onNewTab}
        onStepBack={canStepBack ? () => onStepTab(-1) : undefined}
        onStepForward={canStepForward ? () => onStepTab(1) : undefined}
        onToggleSidebar={onToggleSidebar}
      />
      <View style={styles.body}>
      {/* List pane — animates down to a 48px rail when collapsed on desktop;
          on mobile it is the full screen until a note is tapped. */}
      <Animated.View
        style={[
          styles.listPane,
          // No divider on mobile: the pane is the whole screen, so its right
          // edge is the screen's edge and a rule there is a stray line.
          { borderRightColor: theme.border, borderRightWidth: isMobile ? 0 : 1 },
          isMobile ? [styles.paneMobile, mobileListStyle] : listStyle,
        ]}
      >
        <Animated.View style={[styles.listInner, listContentStyle]}>
          {/*
            The pane's heading.

            `Layout.headerHeight`, the same value as `TopHeader` and the sidebar's
            brand row, so the three bars line up across the column boundary
            instead of the list starting at an arbitrary offset below them. The
            name is truncated rather than wrapped: a two-line heading changes the
            height of the one row that all three share.
          */}
          <View style={styles.listHeader}>
            <Text
              style={[styles.listHeaderLabel, { color: theme.text }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {folderLabel}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 8, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
          >
          {notes.length === 0 ? (
            <Text style={{ color: theme.textMuted, ...Typography.app.body, textAlign: 'center', marginTop: 24 }}>
              No notes yet.
            </Text>
          ) : (
            notes.map((n) => {
              const active = display?.id === n.id;
              const isRenaming = renamingId === n.id;
              return (
                <View
                  key={n.id}
                  style={[
                    styles.listItem,
                    { backgroundColor: active ? theme.pillBg : 'transparent', borderColor: theme.border },
                  ]}
                >
                  {/* The row itself stays pressable and keeps the long-press /
                      right-click menu; the three-dot button is the visible,
                      discoverable way into the same menu.

                      While renaming, the pressable is *replaced* rather than
                      wrapped: nested, a tap meant for the caret would also
                      fire `onSelect` and swap the open note out from under the
                      field the user is typing in. */}
                  {isRenaming ? (
                    <View style={styles.listMain}>
                      <TextInput
                        ref={renameInputRef}
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                        onSubmitEditing={() => commitRename(n.id)}
                        onKeyPress={(e) => {
                          if (e.nativeEvent.key === 'Escape') cancelRename();
                        }}
                        onBlur={() => commitRename(n.id)}
                        autoFocus
                        selectTextOnFocus
                        returnKeyType="done"
                        style={[styles.renameInput, { color: theme.text, borderColor: theme.accent }]}
                        accessibilityLabel="Note title"
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        onSelect(n);
                        // On a phone the list *is* the notebook, so selecting a
                        // note has to take over the screen — otherwise the tap
                        // changes state you cannot see and reads as dead.
                        onOpenEditor();
                      }}
                      onLongPress={(e) => {
                        const { pageX, pageY } = e.nativeEvent;
                        setMenuAnchor({ x: pageX, y: pageY });
                        setMenuNoteId(n.id);
                      }}
                      {...({
                        onContextMenu: (e: AnchorEvent) => {
                          e.preventDefault?.();
                          setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                          setMenuNoteId(n.id);
                        },
                      } as Record<string, unknown>)}
                      style={styles.listMain}
                      accessibilityRole="button"
                      accessibilityLabel={n.title}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={[styles.listMeta, { color: theme.textMuted }]} numberOfLines={1}>
                        {relativeTime(n.updatedAt)}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={(e) => {
                      // Anchored from the press point rather than a measured
                      // button rect — the same reasoning as `SelectRow`.
                      const { pageX, pageY } = e.nativeEvent;
                      setMenuAnchor({ x: pageX, y: pageY });
                      setMenuNoteId(n.id);
                    }}
                    style={styles.listMenu}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${n.title}`}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name="dots-vertical"
                      size={16}
                      color={theme.textMuted}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
          </ScrollView>
        </Animated.View>

        {/*
          The divider between the list and the editor.

          Inside the pane rather than a sibling of it, and anchored to `right`.
          The pane's width is the animated, user-dragged value, so the only edge
          that is always the divider is the pane's own right edge — a handle
          positioned in the parent would have to be told the width all over again
          and would drift the moment the two disagreed.

          Desktop only. On a phone the list and the typing space never share the
          screen, so there is no edge between them to drag and the handle would
          be a control that cannot do the thing it shows.

          It spans the pane's full height rather than sitting at one point on it:
          a 2px line you have to hit within a few pixels is not a handle.
        */}
        {isMobile ? null : (
          <View
            {...resizePan.panHandlers}
            {...({
              // `onHoverIn` / `onHoverOut` are web-only — they never fire on a
              // touch device — and are not in RN's `ViewProps`, so they go
              // through a cast the same way the sidebar's do.
              onHoverIn: () => setHandleHovered(true),
              onHoverOut: () => setHandleHovered(false),
              // `onKeyDown` and `tabIndex` are likewise forwarded to the DOM
              // node by `react-native-web`, which is not in RN's types.
              onKeyDown: resizeKeyDown,
              tabIndex: 0,
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': 'Resize note list',
              'aria-valuenow': listWidth,
              'aria-valuemin': LIST_WIDTH_MIN,
              'aria-valuemax': LIST_WIDTH_MAX,
            } as Record<string, unknown>)}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') nudge(KEYBOARD_STEP);
              if (e.nativeEvent.actionName === 'decrement') nudge(-KEYBOARD_STEP);
            }}
            style={styles.dividerHit}
            accessibilityLabel="Resize note list"
          >
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor:
                    resizing || handleHovered ? theme.accent : theme.border,
                },
              ]}
            />
          </View>
        )}
      </Animated.View>

      {/* Context menu overlay */}
      <ContextMenu
        anchor={menuAnchor}
        actions={noteMenuActions}
        onDismiss={dismissMenu}
        theme={theme}
      />

      {/* Editor pane — Apple Note gapless typing */}
      <Animated.View
        style={[
          styles.editorPane,
          { backgroundColor: theme.background },
          isMobile ? [styles.paneMobile, mobileEditorStyle] : null,
        ]}
      >
        {!display ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="note-edit-outline" size={40} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, ...Typography.app.body, marginTop: 12, textAlign: 'center' }}>
              Select a note or create a new one to start typing.
            </Text>
          </View>
        ) : (
          <View style={styles.editorContainer}>
            <Editor
              note={display}
              theme={theme}
              onContentChange={onContentChange}
              onDelete={onDelete}
            />
          </View>
        )}
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, flexDirection: 'column', minHeight: 0 },
  /**
   * The row that holds the list and editor panes, below the full-width tab
   * strip. `flex: 1` gives it the height the strip leaves, and it is the
   * containing block for the mobile panes' absolute positioning.
   */
  body: { flex: 1, flexDirection: 'row', minWidth: 0, minHeight: 0 },
  /**
   * Mobile clips the sliding panes. Without it the pane parked off-screen is
   * still laid out, so the screen gains a horizontal scrollbar and a sideways
   * drag can drag the *page* rather than closing the editor.
   */
  viewMobile: { overflow: 'hidden' },
  /**
   * One full-screen pane, absolutely positioned so the two overlap instead of
   * sharing a row. `top`/`bottom` are what make it fill the height — a pane with
   * only `left`/`right` sizes to its content and the editor's flex children
   * collapse.
   */
  paneMobile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  listPane: {
    borderRightWidth: 1,
    flexDirection: 'row',
    // `hidden` would clip the divider's hit area: it is centred on the pane's
    // edge with a negative margin, so seven of its fourteen pixels sit outside
    // the pane, and the half you aim at is the half that gets cut. `visible`
    // costs nothing here — the pane is the first child of a clipped-on-mobile
    // parent, and on mobile the handle is not rendered at all.
    overflow: 'visible',
  },
  /** Fades out as the pane narrows, leaving only its divider. */
  listInner: { flex: 1, minWidth: 0 },
  /**
   * The pane's heading row. `headerHeight` so it lines up with `TopHeader` and
   * the sidebar's brand row across the column boundary.
   *
   * No bottom rule: the heading already sits on the canvas between two other
   * headers, and the depth rules put shadow — not outlines — between layers.
   */
  listHeader: {
    height: Layout.headerHeight,
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  listHeaderLabel: { ...Typography.app.cardHeader },
  /**
   * The divider's hit area — 14px wide, so the edge is comfortable to grab.
   *
   * A negative `marginRight` centres it on the pane's edge rather than laying it
   * out inside the pane: a hit area that exists only within the list steals
   * presses from the note rows nearest the edge, which are the ones someone
   * reaching for the divider is least likely to have meant to tap.
   */
  dividerHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 14,
    marginRight: -7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerLine: { width: 2, height: '100%', borderRadius: Radius.full },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  listMain: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  listMenu: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderRadius: Radius.md,
  },
  listTitle: { ...Typography.app.bodyStrong },
  listMeta: { ...Typography.app.caption },
  /**
   * The inline rename field mirrors `listTitle` so the text does not jump when
   * the row swaps between editing and display. The border is the only new
   * thing, and it is the accent so the row reads as being edited.
   */
  renameInput: {
    ...Typography.app.bodyStrong,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editorPane: { flex: 1, minWidth: 0 },
  editorContainer: { flex: 1, flexDirection: 'column' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
