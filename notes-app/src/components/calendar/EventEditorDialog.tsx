import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AnimatedPressable } from '../shared/motion';
import { TimeWheel } from '../shared/TimeWheel';
import { MonthPickerPopover, type MonthPickerAnchor } from './MonthPickerPopover';
import { Radius, Typography, contrastRatio, surfaceTheme, type Theme } from '../../theme';
import {
  EVENT_PRIORITIES,
  PRIORITY_LABELS,
  type Event,
  type EventPriority,
} from '../../types';
import {
  DAY_START_HOUR,
  MINUTE_OPTIONS,
  DEFAULT_DURATION_MINUTES,
  dayHeadingLabel,
  durationLabel,
  hourOptions,
  minutesFromMidnight,
  startOfDay,
  withTime,
} from './calendarUtils';

/** 48px rows — the app's row contract, including the trigger fields. */
const FIELD_HEIGHT = 48;
/** Chips sit below it: five fields plus labels have to fit above the fold. */
const CHIP_HEIGHT = 36;
const CONTROL_WIDTH = 160;
const SWATCH = 16;
const EVENT_LENGTHS = [30, 60, 1440, 'custom'] as const;

function strongerOutline(border: string, text: string): string {
  const borderValue = parseInt(border.slice(1), 16);
  const textValue = parseInt(text.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const start = (borderValue >> shift) & 0xff;
    const end = (textValue >> shift) & 0xff;
    return Math.round(start + (end - start) * 0.15).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function priorityText(level: EventPriority): string {
  if (level === 'high') return 'Important';
  if (level === 'medium') return 'Normal';
  return PRIORITY_LABELS[level];
}

function editorTimeLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const hour12 = hours24 % 12 || 12;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  return `${String(hour12).padStart(2, '0')}:${String(total % 60).padStart(2, '0')} ${suffix}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Thursday, 8th October 2026" — the long form shown in the date field. */
function fullDateLabel(date: Date): string {
  return `${dayHeadingLabel(date)}, ${ordinal(date.getDate())} ${date.getFullYear()}`;
}

/** Everything the dialog collects, before it becomes a repository call. */
export interface EventDraft {
  title: string;
  notes: string;
  startsAt: string;
  durationMinutes: number;
  priority?: EventPriority;
}

/**
 * The event editor.
 *
 * **This replaced inline rename**, which was the only way to say anything about
 * an event: adding one dropped a card called "New Event" and the only edit
 * available was to retype its title in place. Date, time, length and priority
 * were unreachable — there was no way to change them at all.
 *
 * Shape notes, each of which is a decision rather than a default:
 * - **Priority is four swatches side by side, not a dropdown.** Choosing a
 *   colour means comparing them, and a dropdown hides the very thing being
 *   chosen. Every swatch is labelled, so it never relies on colour alone.
 * - **Time is a menu, duration is chips.** A menu for 26 half-hour slots; chips
 *   for the five lengths, because there are few enough to see at once.
 * - **Delete stays in the row's context menu**, not here. Two places to delete
 *   an event is one too many.
 */
export function EventEditorDialog({
  theme,
  visible,
  /** `null` for a new event; the event being edited otherwise. */
  event,
  events,
  /** The date to default to when creating a new event. */
  anchorDate,
  onSave,
  /** Optional: called when the user clicks "Save as draft". Defaults to onSave. */
  onSaveDraft,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  event: Event | null;
  /** Every event, so the day picker can show which days are busy. */
  events: readonly Event[];
  /** The date to default to when creating a new event. Null = today. */
  anchorDate: Date | null;
  onSave: (draft: EventDraft) => void;
  /** Optional: called when the user clicks "Save as draft". Defaults to onSave. */
  onSaveDraft?: (draft: EventDraft) => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);
  const darkError = contrastRatio('#b3352a', ink.surface) >= 4.5 ? '#b3352a' : ink.onSurfaceError;
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  /**
   * How tall the scrolling body may grow.
   *
   * A fixed 420 was a real bug, not a taste call: with five fields the last one
   * — **priority**, the thing most people opened the dialog for — landed below
   * the clip, so its label was visible and its swatches were unclickable.
   *
   * Deriving the height from the window only helps if the content fits at all,
   * so the vertical rhythm below is deliberately tight: 36px chips, 6px gaps.
   * The scroll region is now a genuine fallback for a phone keyboard that
   * leaves very little room, not the normal case.
   */
  const bodyMaxHeight = Math.max(280, Math.min(600, winHeight * 0.68));

  /**
   * Wheel items, built once per render from the same constants the rest of the
   * calendar uses.
   *
   * The hours are the *hour* value (0–23 across the working day) rather than
   * minutes-since-midnight, because that is what the wheel's own min/max
   * announce; the hour's own `minutes % 60` is what carries across when it
   * changes, so moving the hour wheel from 9:15 to 10:15 does not silently reset
   * the minutes.
   */
  const hourItems = hourOptions().map((minutes) => ({
    value: Math.floor(minutes / 60),
    label: String(Math.floor(minutes / 60)).padStart(2, '0'),
  }));
  const minuteItems = MINUTE_OPTIONS.map((minute) => ({
    value: minute,
    label: String(minute).padStart(2, '0'),
  }));

  /**
   * Both wheels share what the dialog leaves them.
   *
   * The card is capped at 540 and the body has no side padding of its own, so
   * the wheels cannot ask the window how wide they are without also asking about
   * the padding, the readout beside them and the gap — three numbers that are
   * only known together. A fixed share of the card is simpler and cannot go
   * negative, which a subtraction from a measured width can.
   */
  const wheelWidth = Math.max(56, Math.min(96, Math.floor(winWidth * 0.1)));

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState(() => startOfDay(anchorDate ?? new Date()));
  const [minutes, setMinutes] = useState(DAY_START_HOUR * 60);
  const [duration, setDuration] = useState<number | null>(DEFAULT_DURATION_MINUTES);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [priority, setPriority] = useState<EventPriority | undefined>(undefined);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reminder, setReminder] = useState<string>('30 min before');
  const [repeat, setRepeat] = useState<string>('Does not repeat');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState<MonthPickerAnchor | null>(null);

  const titleRef = useRef<TextInput>(null);
  const dateTriggerRef = useRef<View>(null);

  const openDatePicker = () => {
    const node = dateTriggerRef.current;
    if (!node) {
      setDateAnchor({ x: 0, y: FIELD_HEIGHT, width: CONTROL_WIDTH });
      return;
    }
    node.measureInWindow((x, y, width) => {
      setDateAnchor({
        x: typeof x === 'number' ? x : 0,
        y: (typeof y === 'number' ? y : 0) + FIELD_HEIGHT,
        width: typeof width === 'number' ? width : CONTROL_WIDTH,
      });
    });
  };

  /**
   * Seed the form whenever the dialog opens.
   *
   * Keyed on `visible` and `event` rather than mounted once, because the dialog
   * stays mounted between openings and would otherwise re-open showing whatever
   * the last edit left behind.
   */
  useEffect(() => {
    if (!visible) return;
    if (event) {
      const start = new Date(event.startsAt);
      setTitle(event.title);
      setNotes(event.notes ?? '');
      setDay(startOfDay(start));
      setMinutes(minutesFromMidnight(start) ?? DAY_START_HOUR * 60);
      setDuration(event.durationMinutes);
      setPriority(event.priority);
    } else {
      setTitle('');
      setNotes('');
      setDay(startOfDay(anchorDate ?? new Date()));
      setMinutes(DAY_START_HOUR * 60);
      setDuration(DEFAULT_DURATION_MINUTES);
      setPriority(undefined);
    }
    setDateAnchor(null);
    setTimePickerOpen(false);
    setLengthOpen(false);
  }, [visible, event, anchorDate]);

  /**
   * Focus the title once the modal has actually mounted.
   *
   * **Two frames, and not `autoFocus`.** A Modal hands focus back as it closes,
   * so `autoFocus` on the way in loses a race it wins about half the time — and
   * the failure is silent: the dialog looks perfect and the keyboard never
   * appears. `useInlineRename` hit exactly this and documents it; this is the
   * same race in the opposite direction, and the same two-frame answer.
   */
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => titleRef.current?.focus());
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  /**
   * Escape closes the dialog. On `document`, for the reason `ContextMenu` gives:
   * focus is inside a portal, so a subtree listener would miss it.
   */
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  /**
   * Save. An empty title becomes "Untitled Event" rather than being blocked —
   * the repository does the same normalisation, and refusing to save over a
   * blank field would be a rule the dialog invents and the store does not.
   */
  const durationMinutes = duration ?? customDuration ?? DEFAULT_DURATION_MINUTES;
  const draft = (): EventDraft => ({
    title: title.trim() || 'Untitled Event',
    notes: notes.trim(),
    startsAt: withTime(day, minutes).toISOString(),
    durationMinutes,
    priority,
  });
  const endTimeLabel = editorTimeLabel(minutes + durationMinutes);

  const save = () => {
    onSave(draft());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            { backgroundColor: theme.scrim },
            Platform.OS === 'web' && {
              // @ts-ignore — RNW maps this to the CSS backdrop-filter property.
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            },
          ]}
          onPress={onDismiss}
          accessibilityLabel="Close the event editor"
          accessibilityRole="button"
        >
          {Platform.OS !== 'web' ? (
            <BlurView intensity={15} tint={theme.name === 'Light' || theme.name === 'B&W' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
          ) : null}
        </Pressable>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: theme.shadow }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: ink.text }]}>New event</Text>
            <Pressable
              style={styles.closeButton}
              onPress={onDismiss}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={ink.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={[styles.body, { maxHeight: bodyMaxHeight }]}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.labelStrong, { color: ink.text }]}>
                Title{' '}
                <Text style={{ color: darkError }}>(required)</Text>
              </Text>
              <TextInput
                ref={titleRef}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Design review with Sam"
                placeholderTextColor={ink.textMuted}
                style={[
                  styles.input,
                  { color: ink.text, borderColor: strongerOutline(ink.border, ink.text), backgroundColor: theme.background },
                ]}
                returnKeyType="done"
                accessibilityLabel="Event title"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.labelStrong, { color: ink.text }]}>Date</Text>
              <AnimatedPressable
                ref={dateTriggerRef}
                onPress={openDatePicker}
                containerStyle={styles.triggerContainer}
                style={[styles.dateTrigger, { borderColor: strongerOutline(ink.border, ink.text), backgroundColor: ink.pillBg }]}
                accessibilityRole="button"
                accessibilityLabel={`Date: ${fullDateLabel(day)}. Change the date.`}
              >
                <Ionicons name="calendar-outline" size={16} color={ink.textMuted} />
                <Text style={[styles.dateValue, { color: ink.text }]}>{fullDateLabel(day)}</Text>
                  <Ionicons name="chevron-down" size={10} color={ink.textMuted} />
              </AnimatedPressable>
            </View>

            <View style={styles.datetimeRow}>
              <View style={styles.datetimeField}>
                <Text style={[styles.labelStrong, { color: ink.text }]}>Length</Text>
                <AnimatedPressable
                  onPress={() => setLengthOpen((open) => !open)}
                  style={[styles.datetimeTrigger, styles.lengthTrigger, { borderColor: strongerOutline(ink.border, ink.text), backgroundColor: ink.pillBg }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: lengthOpen }}
                  accessibilityLabel={`Length: ${duration === null ? 'Custom' : durationLabel(duration)}. Change the length.`}
                >
                  <Text style={[styles.datetimeValue, { color: ink.text }]}>
                    {duration === null ? 'Custom' : durationLabel(duration)}
                  </Text>
                  <View style={[styles.valueChevron, styles.lengthChevron]}>
                    <Ionicons name="chevron-down" size={10} color={ink.textMuted} />
                  </View>
                </AnimatedPressable>
                {lengthOpen && (
                  <ScrollView
                    style={[styles.lengthDropdown, { maxHeight: Math.min(192, Math.max(96, winHeight * 0.3)), backgroundColor: ink.pillBg, borderColor: strongerOutline(ink.border, ink.text) }]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {EVENT_LENGTHS.map((option) => {
                      const isCustom = option === 'custom';
                      return (
                        <Pressable
                          key={String(option)}
                          style={styles.lengthOption}
                          onPress={() => {
                            if (isCustom) {
                              setDuration(null);
                            } else {
                              setDuration(option);
                            }
                            setCustomDuration(null);
                            setLengthOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={isCustom ? 'Custom' : durationLabel(option)}
                        >
                          <Text style={[styles.lengthOptionText, { color: ink.text }]}>
                            {isCustom ? 'Custom' : durationLabel(option)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.datetimeField}>
                <Text style={[styles.labelStrong, styles.datetimeLabel, { color: ink.text }]}>Start</Text>
                <AnimatedPressable
                  onPress={() => setTimePickerOpen((open) => !open)}
                  containerStyle={styles.chipContainer}
                  style={[styles.datetimeTrigger, { borderColor: strongerOutline(ink.border, ink.text), backgroundColor: ink.pillBg }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: timePickerOpen }}
                  accessibilityLabel={`Start time: ${editorTimeLabel(minutes)}. Change the start time.`}
                >
                  <Text style={[styles.datetimeValue, { color: ink.text }]}>{editorTimeLabel(minutes)}</Text>
                </AnimatedPressable>
                {timePickerOpen && (
                  <View style={[styles.timePickerPanel, { backgroundColor: ink.pillBg }]}>
                    <TimeWheel
                      theme={theme}
                      items={hourItems}
                      value={Math.floor(minutes / 60)}
                      onChange={(hour) => setMinutes(hour * 60 + (minutes % 60))}
                      accessibilityLabel="Start hour"
                      width={wheelWidth}
                    />
                    <View style={styles.wheelColon}>
                      <Text style={[styles.wheelColonText, { color: ink.textMuted }]}>:</Text>
                    </View>
                    <TimeWheel
                      theme={theme}
                      items={minuteItems}
                      value={minutes % 60}
                      onChange={(minute) => setMinutes(Math.floor(minutes / 60) * 60 + minute)}
                      accessibilityLabel="Start minute"
                      width={wheelWidth}
                    />
                  </View>
                )}
              </View>

              <View style={styles.datetimeField}>
                <Text style={[styles.labelStrong, styles.datetimeLabel, { color: ink.text }]}>End</Text>
                <View style={[styles.datetimeTrigger, { backgroundColor: ink.pillBg }]}>
                  <Text style={[styles.datetimeValue, { color: ink.textMuted }]}>{endTimeLabel}</Text>
                </View>
              </View>
            </View>

            {duration === null ? (
              <View style={styles.customDurationRow}>
                <Text style={[styles.label, { color: ink.textMuted }]}>Duration</Text>
                <TextInput
                  value={customDuration !== null ? String(customDuration) : ''}
                  onChangeText={(text) => {
                    const parsed = parseInt(text, 10);
                    setCustomDuration(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                  }}
                  keyboardType="number-pad"
                  style={[styles.customDurationInput, { color: ink.text, borderColor: strongerOutline(ink.border, ink.text), backgroundColor: theme.background }]}
                  accessibilityLabel="Custom duration in minutes"
                />
                <Text style={[styles.customUnit, { color: ink.textMuted }]}>minutes</Text>
              </View>
            ) : null}

            <Text style={[styles.labelStrong, { color: ink.text }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {EVENT_PRIORITIES.map((level) => {
                const selected = priority === level;
                const colour = ink.priority[level];
                return (
                  <AnimatedPressable
                    key={level}
                    onPress={() => setPriority(selected ? undefined : level)}
                    containerStyle={styles.priorityContainer}
                    style={[
                      styles.priority,
                      {
                        backgroundColor: ink.pillBg,
                        borderColor: selected ? '#f97316' : strongerOutline(ink.border, ink.text),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Priority: ${priorityText(level)}`}
                  >
                    <MaterialCommunityIcons
                      name="circle"
                      size={8}
                      color={colour}
                      accessibilityElementsHidden
                    />
                    <Text style={[styles.priorityText, { color: ink.text }]}>
                      {priorityText(level)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <AnimatedPressable
              onPress={() => setAdvancedOpen((open) => !open)}
              containerStyle={[styles.advancedContainer, { backgroundColor: ink.pillBg, borderRadius: Radius.lg }]}
              style={styles.advancedHeader}
              accessibilityRole="button"
              accessibilityState={{ expanded: advancedOpen }}
              accessibilityLabel="Advanced options"
            >
              <MaterialCommunityIcons name="cog" size={16} color={ink.textMuted} />
              <Text style={[styles.advancedTitle, { color: ink.text }]}>Advanced options</Text>
              <View style={styles.advancedIcons} accessibilityElementsHidden>
                <Ionicons name="notifications-outline" size={14} color={ink.textMuted} />
                <MaterialCommunityIcons name="repeat" size={14} color={ink.textMuted} />
                <MaterialCommunityIcons name="text-box-outline" size={14} color={ink.textMuted} />
              </View>
              <Ionicons
                name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={ink.textMuted}
              />
            </AnimatedPressable>

            {advancedOpen && (
              <>
                <AnimatedPressable
                  onPress={() => setReminderOpen((open) => !open)}
                  style={[styles.settingRow, styles.settingTrigger, { backgroundColor: ink.pillBg }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: reminderOpen }}
                  accessibilityLabel={`Reminder: ${reminder}. Change reminder.`}
                >
                  <Ionicons name="notifications-outline" size={16} color={ink.textMuted} style={styles.settingIconInset} />
                  <Text style={[styles.settingValue, styles.settingValueFlex, { color: ink.text }]}>{reminder}</Text>
                  <Ionicons name={reminderOpen ? 'chevron-up' : 'chevron-down'} size={10} color={ink.textMuted} />
                </AnimatedPressable>
                {reminderOpen && (
                  <View style={styles.choicePanel}>
                    {['None', 'At time of event', '5 min before', '15 min before', '30 min before', '1 hour before'].map((choice) => (
                      <Pressable key={choice} onPress={() => { setReminder(choice); setReminderOpen(false); }} style={[styles.choice, { backgroundColor: reminder === choice ? ink.pillBg : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: reminder === choice }}>
                        <Text style={[styles.settingValue, { color: ink.text }]}>{choice}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <AnimatedPressable
                  onPress={() => setRepeatOpen((open) => !open)}
                  style={[styles.settingRow, styles.settingTrigger, { backgroundColor: ink.pillBg }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: repeatOpen }}
                  accessibilityLabel={`Repeat: ${repeat}. Change repeat.`}
                >
                  <MaterialCommunityIcons name="repeat" size={16} color={ink.textMuted} style={styles.settingIconInset} />
                  <Text style={[styles.settingValue, styles.settingValueFlex, { color: ink.text }]}>{repeat}</Text>
                  <Ionicons name={repeatOpen ? 'chevron-up' : 'chevron-down'} size={10} color={ink.textMuted} />
                </AnimatedPressable>
                {repeatOpen && (
                  <View style={styles.choicePanel}>
                    {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((choice) => (
                      <Pressable key={choice} onPress={() => { setRepeat(choice); setRepeatOpen(false); }} style={[styles.choice, { backgroundColor: repeat === choice ? ink.pillBg : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: repeat === choice }}>
                        <Text style={[styles.settingValue, { color: ink.text }]}>{choice}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <View style={styles.descriptionHeading}>
                    <MaterialCommunityIcons name="text-box-outline" size={16} color={ink.textMuted} />
                  </View>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add notes"
                    placeholderTextColor={ink.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={[
                      styles.descriptionInput,
                      { color: ink.text, borderColor: strongerOutline(ink.border, ink.text), backgroundColor: theme.background },
                    ]}
                    accessibilityLabel="Event notes"
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <AnimatedPressable
              onPress={onDismiss}
              containerStyle={styles.actionContainer}
              style={styles.cancelAction}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, { color: darkError }]}>Cancel</Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => onSaveDraft ? onSaveDraft(draft()) : onSave(draft())}
              containerStyle={styles.actionContainer}
              style={[styles.draftAction, { borderColor: strongerOutline(ink.border, ink.text) }]}
              accessibilityRole="button"
              accessibilityLabel="Save as draft"
            >
              <Text style={[styles.actionText, { color: ink.text }]}>Save as draft</Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={save}
              containerStyle={styles.actionContainer}
              style={[styles.saveAction, { backgroundColor: theme.selectedFill, borderColor: theme.selectedFill }]}
              accessibilityRole="button"
              accessibilityLabel="Save"
            >
              <Text style={[styles.actionText, { color: theme.selectedText }]}>Save</Text>
            </AnimatedPressable>
          </View>
        </View>

        <MonthPickerPopover
          theme={theme}
          anchor={dateAnchor}
          selected={day}
          events={events}
          onSelectDay={setDay}
          onDismiss={() => setDateAnchor(null)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { pointerEvents: 'auto' },
  card: {
    width: '100%',
    maxWidth: 540,
    borderRadius: Radius.modal,
    // The soft shadow separates this floating layer; no outline is needed.
    padding: 16,
    gap: 16,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...Typography.app.pageHeader },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: {},
  bodyContent: { gap: 16, paddingBottom: 4 },
  fieldGroup: { gap: 8 },
  label: { ...Typography.app.caption },
  labelStrong: { ...Typography.app.captionStrong },
  input: {
    ...Typography.app.body,
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.input * 1.2,
    paddingHorizontal: 12,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.input,
    gap: 4,
    paddingHorizontal: 12,
  },
  dateValue: { ...Typography.app.bodyStrong, flex: 1, minWidth: 0, textAlign: 'center' },
  dateIndicators: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  valueChevron: { flexShrink: 0, marginLeft: -4 },
  lengthChevron: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center', marginLeft: 0, marginRight: 0 },
  triggerContainer: { borderRadius: Radius.input },
  datetimeRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    alignItems: 'flex-start',
  },
  datetimeField: { flex: 1, minWidth: 0, position: 'relative', gap: 8 },
  centeredField: { alignItems: 'center' },
  datetimeLabel: { alignSelf: 'center', textAlign: 'center' },
  lengthTrigger: { position: 'relative', alignSelf: 'stretch' },
  datetimeTrigger: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.input,
    gap: 0,
    paddingHorizontal: 6,
  },
  datetimeValue: { ...Typography.app.bodyStrong, flex: 1, minWidth: 0, textAlign: 'center' },
  lengthDropdown: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 4,
  },
  lengthOption: { height: FIELD_HEIGHT, justifyContent: 'center', paddingHorizontal: 12 },
  lengthOptionText: { ...Typography.app.body },
  timePickerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  wheelColon: { width: 8, alignItems: 'center', justifyContent: 'center' },
  wheelColonText: { ...Typography.app.cardHeader },
  chipContainer: { borderRadius: Radius.full, flex: 1 },
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customUnit: { ...Typography.app.body },
  customDurationInput: {
    ...Typography.app.body,
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    width: 80,
  },
  priorityRow: {
    flexDirection: 'row',
    width: '100%',
    alignSelf: 'stretch',
    gap: 8,
  },
  priorityContainer: { borderRadius: Radius.md, flex: 1, minWidth: 0 },
  priority: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: FIELD_HEIGHT,
    width: '100%',
    borderRadius: Radius.lg,
    paddingHorizontal: 2,
  },
  priorityText: { ...Typography.app.captionStrong, flexShrink: 1, textAlign: 'center' },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: 12,
    width: '100%',
  },
  advancedContainer: { borderRadius: Radius.lg, width: '100%' },
  advancedTitle: { ...Typography.app.bodyStrong, flexShrink: 0 },
  advancedSubtitle: { ...Typography.app.caption, flex: 1, minWidth: 0, textAlign: 'right' },
  advancedIcons: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingRight: 2 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: FIELD_HEIGHT,
  },
  settingTrigger: { paddingHorizontal: 14, borderRadius: Radius.input },
  settingIconInset: { marginLeft: 2 },
  settingLabel: { ...Typography.app.body, flex: 1 },
  settingControl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingValue: { ...Typography.app.body },
  settingValueFlex: { flex: 1 },
  choicePanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 18 },
  choice: { minHeight: CHIP_HEIGHT, justifyContent: 'center', borderRadius: Radius.full, paddingHorizontal: 12 },
  descriptionHeading: { height: 20, justifyContent: 'center', paddingLeft: 18 },
  descriptionInput: {
    ...Typography.app.body,
    minHeight: 96,
    padding: 12,
    borderWidth: 1,
    borderRadius: Radius.input,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  actionContainer: { borderRadius: Radius.lg },
  cancelAction: {
    height: FIELD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  draftAction: {
    width: 128,
    height: FIELD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  saveAction: {
    width: 112,
    height: FIELD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actionText: { ...Typography.app.bodyStrong },
});
