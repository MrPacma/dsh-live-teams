export const STYLE_ID = 'dsh-live-teams/styles'

// UI layout and stylesheet patterns adapted from dsh-context v0.52.1 by bowenliang123,
// Copyright 2025, Apache License 2.0; modified for dsh-live-teams.
export const css = `
/* Layout and type scale adapted from dsh-context v0.52.1 (Apache License 2.0); modified for dsh-live-teams. */
.dshLiveTeamsRoot {
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 20px 32px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}

.dshLiveTeamsCard {
  box-sizing: border-box;
  min-width: 0;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  container: dshLiveTeamsCard / inline-size;
}

.dshLiveTeamsCols {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 14px;
}

.dshLiveTeamsCols > .dshLiveTeamsCard,
.dshLiveTeamsCol > .dshLiveTeamsCard:last-child {
  margin-bottom: 0;
}

.dshLiveTeamsLeadControl { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsLeadControl select { height: 28px; padding: 4px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }

.dshLiveTeamsHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dshLiveTeamsHeaderCopy,
.dshLiveTeamsSectionHeader,
.dshLiveTeamsMemberHeading,
.dshLiveTeamsMemberIdentity,
.dshLiveTeamsNameLine,
.dshLiveTeamsMemberMeta,
.dshLiveTeamsAvailability {
  min-width: 0;
}

.dshLiveTeamsHeaderCopy,
.dshLiveTeamsSectionHeader {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dshLiveTeamsHeader h2,
.dshLiveTeamsSectionHeader h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.dshLiveTeamsHeader h2 {
  font-size: 13px;
}

.dshLiveTeamsHeaderCaption,
.dshLiveTeamsSectionCaption {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsIconButton {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 0;
  border-radius: 28px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsIconButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsIconButton:focus-visible,
.dshLiveTeamsAddButton:focus-visible,
.dshLiveTeamsCandidate:focus-within,
.dshLiveTeamsModalField input:focus-visible,
.dshLiveTeamsModalField select:focus-visible,
.dshLiveTeamsModalField textarea:focus-visible,
.dshLiveTeamsMemberAction:focus-visible,
.dshLiveTeamsInterruptButton:focus-visible,
.dshLiveTeamsEditNameButton:focus-visible,
.dshLiveTeamsApply:focus-visible,
.dshLiveTeamsRoleInput:focus-visible,
.dshLiveTeamsNameInput:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsIconButton:disabled,
.dshLiveTeamsMemberAction:disabled,
.dshLiveTeamsEditNameButton:disabled,
.dshLiveTeamsApply:disabled,
.dshLiveTeamsRoleInput:disabled,
.dshLiveTeamsNameInput:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsBriefing pre { margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary); font: inherit; }

.dshLiveTeamsCollapseHeader { display: flex; align-items: center; gap: 8px; width: 100%; padding: 0; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; }
.dshLiveTeamsCollapseHeaderCopy { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.dshLiveTeamsCollapseHeaderCopy strong { font-size: 13px; font-weight: 600; }
.dshLiveTeamsCollapseHeaderCopy span { overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsDisclosure { display: inline-flex; flex: none; color: var(--dsw-alias-label-tertiary); transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsPanelExpanded .dshLiveTeamsDisclosure { transform: rotate(180deg); }
.dshLiveTeamsBriefing > .dshLiveTeamsAddButton { margin-top: 8px; }
.dshLiveTeamsJournal { display: flex; flex-direction: column; gap: 8px; }
.dshLiveTeamsJournalFilters { display: flex; flex-wrap: wrap; gap: 4px; }
.dshLiveTeamsJournalFilter { padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; }
.dshLiveTeamsJournalFilterActive { background: var(--dsw-alias-interactive-bg-active); color: var(--dsw-alias-label-primary); }
/* The journal is what a person actually reads, so it takes the height it can: the old 320px cap
   showed about eight rows and hid the rest behind its own scrollbar. The card below it (messages)
   is collapsed to one line unless it has something for the human, so this costs no other section. */
.dshLiveTeamsJournalList { display: flex; flex-direction: column; gap: 2px; max-height: min(58vh, 760px); margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.dshLiveTeamsJournalRow { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 3px 0; font-size: 12px; }
.dshLiveTeamsJournalIcon { flex: none; width: 12px; color: var(--dsw-alias-label-tertiary); text-align: center; }
.dshLiveTeamsJournalKind { flex: none; padding: 1px 6px; border-radius: 4px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-size: 10px; font-weight: 600; line-height: 1.2; }
.dshLiveTeamsJournalSummary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsJournalRefs { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dshLiveTeamsJournalTime { flex: none; color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
.dshLiveTeamsJournalDetail { flex-basis: 100%; padding-left: 20px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.55; }
.dshLiveTeamsMemberCollapsed { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 0; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; list-style: none; }
.dshLiveTeamsMemberCollapsed::-webkit-details-marker { display: none; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsMemberName { flex: none; width: auto; font-size: 12px; line-height: 16px; }
.dshLiveTeamsMemberChip { flex: none; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; }
.dshLiveTeamsMemberLive { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsMemberLiveOn { color: var(--dsw-alias-state-success-primary); }
.dshLiveTeamsMemberNote { min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsRow:not(.dshLiveTeamsRowSelected) > .dshLiveTeamsMemberCollapsed { min-height: 28px; }
.dshLiveTeamsRoles > .dshLiveTeamsCollapseHeader { margin-bottom: 0; }
.dshLiveTeamsRoles.dshLiveTeamsPanelExpanded > .dshLiveTeamsRoleActions { margin-top: 8px; }
.dshLiveTeamsTasks { width: 100%; box-sizing: border-box; }
.dshLiveTeamsTaskFilter { display: flex; flex-wrap: wrap; }
.dshLiveTeamsTaskList { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dshLiveTeamsTaskRow { min-width: 0; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dshLiveTeamsTaskSummary { display: grid; grid-template-columns: 14px auto minmax(0, 1fr) minmax(0, 1.2fr) 36px 42px; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 1.35; text-align: left; cursor: pointer; transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsTaskSummary:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshLiveTeamsTaskDisclosure { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: var(--dsw-alias-label-tertiary); transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsTaskDisclosureOpen { transform: rotate(180deg); }
/* A blocked task must not read as a claimable one: warn tone, and only on blocked rows. */
.dshLiveTeamsTaskBlocked { flex: none; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskQueued { flex: none; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskControls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dshLiveTeamsSubmissionScope { margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: color-mix(in srgb, var(--dsw-alias-text-secondary) 12%, transparent); color: var(--dsw-alias-text-secondary); }
.dshLiveTeamsSubmissionScope.dshLiveTeamsScopeshared-tree { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsSubmissionScope.dshLiveTeamsScopescopeviolation { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 15%, transparent); color: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsMemberOpen { flex: none; padding: 2px 8px; border: 1px solid var(--dsw-alias-border-secondary); border-radius: 6px; background: transparent; color: var(--dsw-alias-text-secondary); font-size: 11px; line-height: 1.4; cursor: pointer; }
.dshLiveTeamsMemberOpen:hover:not(:disabled) { border-color: var(--dsw-alias-border-primary); color: var(--dsw-alias-text-primary); }
.dshLiveTeamsMemberOpen:disabled { opacity: 0.45; cursor: default; }
.dshLiveTeamsTaskAttempts { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.dshLiveTeamsTaskAttempts li { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.dshLiveTeamsTaskIntervened { flex: none; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); font-size: 10px; font-weight: 600; line-height: 1.35; }
.dshLiveTeamsDispatchToggle { padding: 1px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 11px; cursor: pointer; transition: color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out); }
.dshLiveTeamsDispatchToggle:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-secondary); }
.dshLiveTeamsDispatchToggle:disabled { opacity: .5; cursor: default; }
.dshLiveTeamsDispatchTogglePaused { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsTaskRound { width: 36px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshLiveTeamsTaskAge { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshLiveTeamsTaskStatus { display: inline-flex; width: max-content; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.dshLiveTeamsTaskTitle, .dshLiveTeamsTaskRoute { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsTaskTitle { font-weight: 600; }
.dshLiveTeamsTaskRoute { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsTaskDetail { display: flex; flex-direction: column; gap: 12px; padding: 12px; border-top: 1px solid var(--dsw-alias-border-l2); font-size: 12px; line-height: 1.55; }
.dshLiveTeamsTaskDetail h4 { margin: 0 0 5px; font-size: 12px; }
.dshLiveTeamsTaskDetail p { margin: 0; }
.dshLiveTeamsTaskDetail pre { max-height: 320px; margin: 0; overflow-y: auto; padding: 8px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--dsw-alias-bg-layer-1); border-radius: 6px; font: inherit; }
.dshLiveTeamsTaskDetail ul, .dshLiveTeamsTaskDetail ol { margin: 4px 0 0; padding-left: 20px; }
.dshLiveTeamsTaskFacts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
.dshLiveTeamsTaskFacts dt { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 600; }
.dshLiveTeamsTaskFacts dd { margin: 3px 0 0; }
.dshLiveTeamsTaskActions { display: flex; flex-wrap: wrap; gap: 8px; }
.dshLiveTeamsTaskInput { box-sizing: border-box; width: 100%; min-height: 72px; resize: vertical; padding: 7px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; }
.dshLiveTeamsNarrowPanel { min-width: 0; }

.dshLiveTeamsSummary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dshLiveTeamsSummaryGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  margin: 0;
  gap: 6px;
}

.dshLiveTeamsStat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 3px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  text-align: center;
}

.dshLiveTeamsStat dt,
.dshLiveTeamsStat dd {
  margin: 0;
}

.dshLiveTeamsStatValue {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.dshLiveTeamsStatLabel {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsNotice,
.dshLiveTeamsMessage {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}

.dshLiveTeamsNotice {
  padding: 9px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsRoles {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsRoleActions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dshLiveTeamsRoleList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRoleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
}

.dshLiveTeamsRoleIdentity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  min-width: 0;
}

.dshLiveTeamsRoleName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRoleState {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsRoles h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.dshLiveTeamsComposer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dshLiveTeamsComposer textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsComposer select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsInboxList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsInboxRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsInboxRow p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshLiveTeamsInboxKind,
.dshLiveTeamsInboxAcknowledged { display: block; color: var(--dsw-alias-label-secondary); font-size: 11px; }

.dshLiveTeamsMembers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dshLiveTeamsMembers > .dshLiveTeamsWorkspacePath {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.dshLiveTeamsAdoptionList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dshLiveTeamsAdoptionRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsTeamToggle {
  box-sizing: border-box;
  align-self: flex-start;
  padding: 6px 11px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsTeamToggle:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsTeamToggle:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsAddButton {
  align-self: flex-start;
}

.dshLiveTeamsAddButton {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}

.dshLiveTeamsAddButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsAddForm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  /*
   * The add-member dialog holds a Session picker whose length is unbounded (a workspace keeps every
   * Session it ever ran; 20+ candidates on a real team). Scrolling the *form* rather than the list
   * keeps one scrollbar, and the primitive Modal's footer — with the create button — stays reachable
   * because it lives outside this form.
   */
  max-height: min(60vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-inline: 2px;
  scrollbar-gutter: stable;
}

.dshLiveTeamsCandidateList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.dshLiveTeamsCandidate {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  cursor: pointer;
}

.dshLiveTeamsCandidate:has(input:checked) {
  border-color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsCandidateCopy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.dshLiveTeamsCandidateCopy strong,
.dshLiveTeamsCandidateCopy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsCandidateCopy strong {
  font-weight: 600;
}

.dshLiveTeamsCandidateCopy span {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}

.dshLiveTeamsModalField {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* The container the task form puts its fields in: without it the dialog had no vertical rhythm. */
.dshLiveTeamsModalFields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* One box for every control in a dialog. Selects and textareas used to be left native, which is
   why the create-task form looked like a browser form next to the rest of the panel. */
.dshLiveTeamsModalField input,
.dshLiveTeamsModalField select,
.dshLiveTeamsModalField textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dshLiveTeamsModalField textarea {
  height: auto;
  min-height: 64px;
  padding: 6px 8px;
  line-height: 18px;
  resize: vertical;
}

.dshLiveTeamsModalField select {
  /* The platform arrow is kept: a custom one would need an asset, and every other select in this
     panel is native too. What matters is the box, and that is now the same as the inputs. */
  cursor: pointer;
}

.dshLiveTeamsRows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(270px, 100%), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRow {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsMemberHeading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dshLiveTeamsMemberIdentity {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dshLiveTeamsNameLine {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dshLiveTeamsEditNameButton {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRow:hover .dshLiveTeamsEditNameButton,
.dshLiveTeamsRow:focus-within .dshLiveTeamsEditNameButton,
.dshLiveTeamsEditNameButton:focus-visible {
  opacity: 1;
}

.dshLiveTeamsEditNameButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsInterruptButton,
.dshLiveTeamsMemberRemove {
  appearance: none;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-state-error-primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.dshLiveTeamsInterruptButton {
  color: var(--dsw-alias-state-warn-primary);
}

.dshLiveTeamsInterruptButton:hover:not(:disabled),
.dshLiveTeamsMemberRemove:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsInterruptButton:disabled,
.dshLiveTeamsMemberRemove:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.dshLiveTeamsNameInput {
  box-sizing: border-box;
  min-width: 0;
  width: min(100%, 220px);
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  line-height: 18px;
}

.dshLiveTeamsNameActions {
  display: inline-flex;
  flex: none;
  gap: 6px;
}

.dshLiveTeamsFieldError {
  margin: 2px 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsMemberAction {
  appearance: none;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dshLiveTeamsMemberAction:hover:not(:disabled) strong,
.dshLiveTeamsMemberAction:focus-visible strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.dshLiveTeamsMemberAction:disabled {
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsMemberName {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsState {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsStateDot {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 18px;
}

.dshLiveTeamsStateLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsControls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
}

.dshLiveTeamsRoleField {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dshLiveTeamsFieldLabel {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.dshLiveTeamsRoleInput {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  line-height: 18px;
}

.dshLiveTeamsApply {
  flex: none;
}

.dshLiveTeamsAvailabilityTag {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsMemberMeta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px 10px;
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dshLiveTeamsMetaValue {
  min-width: 0;
  overflow-wrap: anywhere;
}

.dshLiveTeamsVisuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.dshLiveTeamsRoster {
  position: relative;
  min-width: 0;
}

/*
 * The attention chip sits in the Session header, where every other control is a
 * quiet icon button. It is the one thing there that must be noticed, so it is the
 * only one allowed a filled background — and only while someone is waiting.
 */
.dshLiveTeamsAttention {
  box-sizing: border-box;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  min-width: 0;
  padding: 3px 9px;
  border: 1px solid var(--dsw-alias-state-warn-primary);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.dshLiveTeamsAttention:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 20%, transparent);
}

.dshLiveTeamsAttention:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsAttentionBusy {
  cursor: progress;
  opacity: 0.7;
}

.dshLiveTeamsAttentionDot {
  flex: none;
  color: var(--dsw-alias-state-warn-primary);
  font-size: 9px;
  line-height: 1;
}

.dshLiveTeamsAttentionName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.dshLiveTeamsAttentionMore,
.dshLiveTeamsAttentionCount {
  flex: none;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dshLiveTeamsRosterEntry {
  box-sizing: border-box;
  appearance: none;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 7px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRosterEntry:hover,
.dshLiveTeamsRosterEntry:focus-visible {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsRosterEntry:focus-visible,
.dshLiveTeamsRosterRow:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dshLiveTeamsRosterMark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: var(--dsw-alias-brand-primary);
  font-size: 12px;
}

.dshLiveTeamsRosterTeam {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRosterSummary {
  flex: none;
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.dshLiveTeamsRosterPopover {
  position: absolute;
  z-index: 10;
  left: 0;
  bottom: calc(100% + 6px);
  box-sizing: border-box;
  width: min(300px, calc(100vw - 24px));
  max-height: min(360px, calc(100vh - 24px));
  padding: 6px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--ds-shadow-lv3, var(--ds-shadow-lv2));
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsRosterList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dshLiveTeamsRosterListItem {
  min-width: 0;
}

.dshLiveTeamsRosterRow {
  box-sizing: border-box;
  appearance: none;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsRosterRow:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dshLiveTeamsRosterRowUnbound {
  cursor: default;
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsRosterRowUnbound:hover {
  background: transparent;
}

.dshLiveTeamsRosterName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshLiveTeamsRosterMarker {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}

.dshLiveTeamsRosterMarker[data-state="live"] {
  background: var(--dsw-alias-state-success-primary);
}

.dshLiveTeamsRosterMarker[data-state="paused"] {
  background: var(--dsw-alias-state-warn-primary);
}

.dshLiveTeamsRosterMarker[data-state="not-live"] {
  background: var(--dsw-alias-state-error-primary);
}

/* B25.1: the actual rendered dsh-context cascade is its compact root-qualified
   shell. These rules intentionally override the earlier generic component rules. */
.dshLiveTeamsRoot .dshLiveTeamsCard {
  box-sizing: border-box;
  margin-bottom: 7px;
  padding: 7px 8px;
  container: dshLiveTeamsCard / inline-size;
}
.dshLiveTeamsShell { min-width: 0; }
.dshLiveTeamsRoot .dshLiveTeamsCols {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 7px;
}
.dshLiveTeamsHead > .dshLiveTeamsCard,
.dshLiveTeamsMain > .dshLiveTeamsCol {
  flex: 1;
  min-width: min(360px, 100%);
}
.dshLiveTeamsCol { min-width: 0; }
.dshLiveTeamsCol > .dshLiveTeamsCard:last-child { margin-bottom: 0; }
.dshLiveTeamsMembers { width: 100%; }

.dshLiveTeamsCardTitle {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
}
.dshLiveTeamsCardTitleText { flex: none; margin: 0; font-size: 13px; white-space: nowrap; }
.dshLiveTeamsSegmented {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-left: auto;
  padding: 1px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
/* The action sits in the segmented row, so it is shaped like the segments rather than like a
   standalone outline button (the human saw it sticking out of the row). */
.dshLiveTeamsTaskNew {
  padding: 3px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsTaskNew:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1);
}

.dshLiveTeamsSegmentedButton {
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}
.dshLiveTeamsSegmentedButton:hover { color: var(--dsw-alias-label-primary); }
.dshLiveTeamsSegmentedButtonActive,
.dshLiveTeamsSegmentedButtonActive:hover {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
.dshLiveTeamsTaskFilter { margin-top: 0; margin-bottom: 0; }
.dshLiveTeamsKindCount { margin-left: 4px; opacity: .65; font-variant-numeric: tabular-nums; }
.dshLiveTeamsSegmentedButtonActive .dshLiveTeamsKindCount { opacity: .85; }

.dshLiveTeamsTeamControls { display: flex; flex-direction: column; gap: 7px; }
.dshLiveTeamsTeamControls .dshLiveTeamsHeader { align-items: center; gap: 7px; }
.dshLiveTeamsTeamControls .dshLiveTeamsHeaderCopy { flex: 1; }
.dshLiveTeamsTeamControls .dshLiveTeamsLeadControl { flex-direction: row; align-items: center; margin-left: auto; }
.dshLiveTeamsTeamControls .dshLiveTeamsLeadControl select { height: 26px; }
.dshLiveTeamsTeamControls .dshLiveTeamsTeamToggle { align-self: center; padding: 4px 8px; font-size: 11px; }
.dshLiveTeamsBriefing,
.dshLiveTeamsControlDisclosure { padding-top: 7px; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsBriefing > .dshLiveTeamsAddButton { margin-top: 5px; }

.dshLiveTeamsJournal { gap: 0; }
.dshLiveTeamsJournalFilters { max-width: 100%; }
.dshLiveTeamsJournalRow { flex-wrap: wrap; gap: 8px; padding: 3px 0; }
.dshLiveTeamsJournalIcon { width: 18px; }
.dshLiveTeamsJournalDetail { box-sizing: border-box; width: 100%; padding-left: 26px; }
.dshLiveTeamsJournalKind-message { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent); color: var(--dsw-alias-brand-primary); }
.dshLiveTeamsJournalKind-delivery { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 15%, transparent); color: var(--dsw-alias-state-success-primary); }
.dshLiveTeamsJournalKind-task { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsJournalKind-review { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 15%, transparent); color: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsJournalKind-contact,
.dshLiveTeamsJournalKind-team,
.dshLiveTeamsJournalKind-member,
.dshLiveTeamsJournalKind-other { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 15%, transparent); color: var(--dsw-alias-label-secondary); }

.dshLiveTeamsTasks .dshLiveTeamsTaskList { gap: 4px; }
.dshLiveTeamsTasks .dshLiveTeamsTaskRow { border-radius: 8px; }
.dshLiveTeamsTasks .dshLiveTeamsTaskSummary { padding: 7px 10px; }

.dshLiveTeamsMembers { gap: 7px; }
.dshLiveTeamsMembers > .dshLiveTeamsSectionHeader { flex-direction: row; align-items: baseline; }
.dshLiveTeamsMembers > .dshLiveTeamsSectionHeader .dshLiveTeamsSectionCaption { display: none; }
.dshLiveTeamsMembers > .dshLiveTeamsAddButton { margin-top: -35px; margin-left: auto; }
.dshLiveTeamsRows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dshLiveTeamsRows > .dshLiveTeamsRow {
  flex: 1 1 150px;
  min-width: 150px;
  max-width: 190px;
}

.dshLiveTeamsRow {
  gap: 7px;
  padding: 6px 8px;
  border-radius: 8px;
}
.dshLiveTeamsRow {
  border-top: 2px solid var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
  background: color-mix(in srgb, var(--dsh-live-team-role-accent, var(--dsw-alias-label-secondary)) 5%, var(--dsw-alias-bg-layer-2));
  transition: border-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out), background-color var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}
.dshLiveTeamsRow[data-role="lead"],
.dshLiveTeamsMemberPanel[data-role="lead"] { --dsh-live-team-role-accent: var(--dsw-alias-state-error-primary); }
.dshLiveTeamsRow[data-role="oracle"],
.dshLiveTeamsMemberPanel[data-role="oracle"] { --dsh-live-team-role-accent: color-mix(in srgb, var(--dsw-alias-brand-primary) 58%, var(--dsw-alias-state-error-primary)); }
.dshLiveTeamsRow[data-role="verifier"],
.dshLiveTeamsMemberPanel[data-role="verifier"] { --dsh-live-team-role-accent: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsRow[data-role="builder"],
.dshLiveTeamsMemberPanel[data-role="builder"] { --dsh-live-team-role-accent: var(--dsw-alias-brand-primary); }
.dshLiveTeamsRowSelected {
  z-index: 1;
  box-shadow: 0 0 0 1px var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
}
.dshLiveTeamsRowSelected details { min-width: 0; }

/* The unfolding controls of the selected member. They live outside the ribbon so
   the compact cells never move or stretch; the accent ties the panel to its
   card. Everything sits on one compact grid instead of a tall stack. */
.dshLiveTeamsMemberPanel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 6px;
  padding: 7px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-left: 2px solid var(--dsh-live-team-role-accent, var(--dsw-alias-border-l2));
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsh-live-team-role-accent, var(--dsw-alias-label-secondary)) 5%, var(--dsw-alias-bg-layer-2));
  font-size: 12px;
}
.dshLiveTeamsMemberPanel > .dshLiveTeamsMemberHeading,
.dshLiveTeamsMemberPanel > .dshLiveTeamsMemberMeta,
.dshLiveTeamsMemberPanel > .dshLiveTeamsFieldError { flex: 1 1 100%; }
.dshLiveTeamsMemberPanel > .dshLiveTeamsControls,
.dshLiveTeamsMemberPanel > .dshLiveTeamsContactGrant { flex: 1 1 300px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberHeading { gap: 8px; align-items: center; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberIdentity { flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 6px; min-width: 0; }
/* A fixed basis keeps Save/Cancel on the same line as the field they save. */
.dshLiveTeamsMemberPanel .dshLiveTeamsNameInput { flex: 0 1 200px; width: auto; min-width: 120px; }
/* The state keeps its width: the field shrinks first. */
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberIdentity > .dshLiveTeamsState { flex: none; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberActions { align-items: center; gap: 6px; margin-left: auto; }
.dshLiveTeamsMemberPanel .dshLiveTeamsEditNameButton { opacity: 1; }
/* flex-end keeps Apply level with the select, not with the label above it. */
.dshLiveTeamsMemberPanel .dshLiveTeamsControls { flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsRoleField { flex: 0 1 160px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsContactGrant { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.dshLiveTeamsContactSelect { flex: 0 1 190px; width: auto; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberMeta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; padding-top: 6px; }
.dshLiveTeamsMemberPanel .dshLiveTeamsMemberMeta .dshLiveTeamsMemberRemove { margin-left: auto; }
.dshLiveTeamsMemberActions { display: flex; flex: none; align-items: center; gap: 4px; }
.dshLiveTeamsMemberCollapsed { align-items: flex-start; flex-wrap: wrap; gap: 4px 6px; padding: 0; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsDisclosure { margin-top: 1px; }
.dshLiveTeamsMemberCollapsed .dshLiveTeamsMemberName { flex: 1; min-width: 72px; }
.dshLiveTeamsMemberNote { flex-basis: calc(100% - 20px); margin-left: 20px; }

.dshLiveTeamsComposer { gap: 7px; margin-bottom: 7px; }
.dshLiveTeamsInboxList { gap: 0; }
.dshLiveTeamsInboxRow { padding: 5px 0; border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); border-radius: 0; background: transparent; font-size: 12px; }
.dshLiveTeamsInboxRow:last-child { border-bottom: 0; }

@media (max-width: 700px) {
  .dshLiveTeamsCols { flex-direction: column; }
  .dshLiveTeamsHead > .dshLiveTeamsCard,
  .dshLiveTeamsMain > .dshLiveTeamsCol { min-width: 0; }
}

@container dshLiveTeamsCard (max-width: 380px) {
  .dshLiveTeamsCardTitle { align-items: flex-start; }
  .dshLiveTeamsSegmented { width: 100%; margin-left: 0; }
  .dshLiveTeamsJournalRefs { display: none; }
}

@container dshLiveTeamsCard (max-width: 700px) {
  .dshLiveTeamsTaskSummary { grid-template-columns: 14px auto minmax(0, 1fr) 36px 42px; }
  .dshLiveTeamsTaskRoute { grid-column: 3 / -1; }
  .dshLiveTeamsTaskFacts { grid-template-columns: 1fr; }
}

@container dshLiveTeamsCard (max-width: 480px) {
  .dshLiveTeamsHeader {
    flex-wrap: wrap;
  }

  .dshLiveTeamsHeader .dshLiveTeamsIconButton {
    margin-left: auto;
  }

  .dshLiveTeamsControls {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .dshLiveTeamsRoleField {
    flex-basis: calc(100% - 88px);
  }
}
/* A journal row is a button so it can be unfolded: the line keeps the old layout, and the panel
   below it is what a person reads when the one-line summary is not enough. */
.dshLiveTeamsJournalLine {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dshLiveTeamsJournalLine:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.dshLiveTeamsJournalDisclosure {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
  transition: transform var(--ds-transition-duration, .2s) var(--ds-ease-in-out, ease-in-out);
}

.dshLiveTeamsJournalDisclosureOpen {
  transform: rotate(180deg);
}

.dshLiveTeamsJournalDetailPanel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-basis: 100%;
  margin: 6px 0 2px 18px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.dshLiveTeamsJournalFields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 6px 14px;
  margin: 0;
}

.dshLiveTeamsJournalField {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dshLiveTeamsJournalField dt {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.dshLiveTeamsJournalField dd {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.dshLiveTeamsJournalBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dshLiveTeamsJournalBodyHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dshLiveTeamsJournalRawToggle {
  padding: 2px 6px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsJournalRawToggle:hover {
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsJournalRaw {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-mono, ui-monospace, monospace);
  font-size: 11px;
  line-height: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* The markdown component renders at the application's reading size (14px base, 21px headings),
   which is right for a chat message and too big for a journal row. It takes its sizes from font
   tokens, so the journal re-points the tokens instead of fighting its selectors. */
.dshLiveTeamsJournalMarkdown {
  --dsh-content-font-size: 11px;
  --dsh-content-font-delta: -2px;
  --dsh-content-font-size-secondary: 10px;
  --dsh-content-font-delta-secondary: -2px;
  --dsw-font-markdown-base: var(--dsh-content-font-size) / 16px var(--dsw-font-family);
  --dsw-font-markdown-small: 10px / 15px var(--dsw-font-family);
  --dsw-font-markdown-code: 10px / 15px var(--ds-font-family-code);
  --dsw-font-markdown-table: var(--dsh-content-font-size-secondary) / 15px var(--dsw-font-family);
  --dsw-font-markdown-h1: 700 14px / 20px var(--dsw-font-family);
  --dsw-font-markdown-h2: 700 13px / 19px var(--dsw-font-family);
  --dsw-font-markdown-h3: 700 12px / 18px var(--dsw-font-family);
  --dsw-font-markdown-h4: 600 11px / 17px var(--dsw-font-family);
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 11px;
  line-height: 16px;
}

/* Headings inside a journal row must not push the row apart. */
.dshLiveTeamsJournalMarkdown :where(h1, h2, h3, h4, h5, h6) {
  margin: 8px 0 4px;
}

.dshLiveTeamsJournalMarkdown :where(p, ul, ol) {
  margin: 6px 0;
}

.dshLiveTeamsJournalTaskLine {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 16px;
}

.dshLiveTeamsJournalAcceptance {
  margin: 0;
  padding-left: 18px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsJournalPending {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
}

/* The inbox is a list of things waiting for the human, so it lives in the journal header as one
   control that opens over the panel — the journal is what a person reads, and a second card for
   messages took the height it needed. */
.dshLiveTeamsJournalControls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.dshLiveTeamsInboxButton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsInboxButton:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1);
}

.dshLiveTeamsInboxButtonUnread {
  border-color: var(--dsw-alias-border-primary);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsInboxCount {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-size: 10px;
  font-weight: 600;
}

/* The application's Modal is a small-confirmation card (380px), and an agent's report is not a
   confirmation: the inbox opens in a panel wide enough to read one. */
.dshLiveTeamsOverlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--dsw-alias-bg-mask-1);
  backdrop-filter: var(--dsw-mask-blur);
}

.dshLiveTeamsDialog {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(760px, 92vw);
  max-height: 84vh;
  padding: 16px 20px 20px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  box-shadow: 0 12px 32px var(--dsw-alias-bg-mask-drop);
}

.dshLiveTeamsDialogHead {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 28px;
}

.dshLiveTeamsDialogTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.dshLiveTeamsDialogDescription {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}

.dshLiveTeamsDialogClose {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.dshLiveTeamsDialogClose:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsDialogBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
}

.dshLiveTeamsCompatibility {
  margin: 0 0 12px;
  padding: 8px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsCompatibilityBad {
  border-color: var(--dsw-alias-border-primary);
  color: var(--dsw-alias-label-primary);
}

.dshLiveTeamsPanelError {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-primary);
  border-radius: 8px;
  font-size: 12px;
  line-height: 17px;
}

.dshLiveTeamsPanelError p {
  margin: 0;
}

.dshLiveTeamsPanelErrorHint {
  color: var(--dsw-alias-label-secondary);
}

.dshLiveTeamsPanelErrorStack {
  margin: 0;
  max-height: 120px;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
  color: var(--dsw-alias-label-secondary);
}

/* Task-first Team: visual hierarchy matched to the approved mockup; no host theme overrides. */
.dshLiveTeamsTaskFirst { --dsh-team-accent: var(--dsw-alias-state-business-primary, rgb(237 135 83)); padding: 14px 18px 28px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsShell { display: flex; flex-direction: column; gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsHead { min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMain { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMain > .dshLiveTeamsCard { width: 100%; margin: 0; padding: 14px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsCard { border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 78%, transparent); border-radius: 9px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 0; padding: 12px 16px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary > .dshLiveTeamsSectionHeader { flex: 0 1 auto; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 17px; font-weight: 600; line-height: 24px; overflow-wrap: anywhere; }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummary h2::before { content: ''; width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--dsw-alias-state-success-primary, rgb(69 189 123)); }
.dshLiveTeamsTaskFirst .dshLiveTeamsSummaryGrid { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStat { display: flex; flex-direction: row-reverse; align-items: baseline; gap: 4px; padding: 0; min-height: 0; border: 0; background: transparent; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStat[hidden] { display: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStatLabel { font-size: 11px; font-weight: 400; line-height: 18px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsStatValue { margin: 0; font-size: 11px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.dshLiveTeamsOverviewActions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.dshLiveTeamsSettingsToggle { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent); color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; cursor: pointer; }
.dshLiveTeamsSettingsToggle svg { width: 14px; height: 14px; }
.dshLiveTeamsSettingsToggle:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshLiveTeamsTaskFirst .dshLiveTeamsCardTitle { align-items: center; gap: 18px; margin-bottom: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsCardTitleText { font-size: 14px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskControls { display: contents; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilter { order: 1; gap: 12px; margin: 0 auto 0 0; border: 0; padding: 0; background: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilterButton { border-radius: 0; padding: 7px 3px; border-bottom: 2px solid transparent; background: none; font-size: 11px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilterButtonActive { color: var(--dsw-alias-label-primary); background: none; border-bottom-color: var(--dsh-team-accent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsDispatchToggle { order: 2; font-size: 10px; opacity: .8; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskNew { display: inline-flex; align-items: center; justify-content: center; gap: 5px; order: 3; padding: 7px 11px; border: 1px solid color-mix(in srgb, var(--dsh-team-accent) 75%, white); border-radius: 6px; background: var(--dsh-team-accent); color: rgb(30 21 16); font-size: 11px; font-weight: 600; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskNew:hover:not(:disabled) { background: rgb(244 155 112); color: rgb(30 21 16); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskList { gap: 7px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRow { background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, var(--dsw-alias-bg-layer-2)); border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskSummary { display: grid; grid-template-columns: 32px minmax(0, 1fr) minmax(90px, 130px) minmax(115px, 160px) 30px 86px; align-items: center; gap: 14px; padding: 14px 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskDisclosure { position: relative; width: 32px; height: 34px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: rgb(255 255 255 / 4%); transform: none; }
.dshLiveTeamsTaskChevron { position: absolute; right: -5px; bottom: -2px; display: flex; background: var(--dsw-alias-bg-layer-1); border-radius: 50%; }
.dshLiveTeamsTaskDisclosureOpen .dshLiveTeamsTaskChevron { transform: rotate(180deg); }
.dshLiveTeamsMemberCount { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 400; }
.dshLiveTeamsTaskIdentity { display: flex; flex-direction: column; min-width: 0; gap: 6px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskTitle { white-space: normal; overflow-wrap: anywhere; font-size: 13px; font-weight: 550; line-height: 19px; }
.dshLiveTeamsTaskMetadata { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRoute { grid-column: auto; white-space: normal; overflow-wrap: anywhere; font-size: 11px; }
.dshLiveTeamsTaskOwner, .dshLiveTeamsTaskStage, .dshLiveTeamsTaskFirst .dshLiveTeamsTaskAge { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; min-width: 0; font-size: 12px; text-align: left; }
.dshLiveTeamsTaskOwner > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.dshLiveTeamsTaskOwner small, .dshLiveTeamsTaskStage small, .dshLiveTeamsTaskAge small { color: var(--dsw-alias-label-tertiary); font-size: 10px; font-weight: 400; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskStatus { padding: 4px 7px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px; font-size: 10px; font-weight: 500; white-space: normal; }
.dshLiveTeamsTaskStage[data-status='in_progress'] .dshLiveTeamsTaskStatus { background: rgb(49 133 85 / 18%); border-color: rgb(83 171 121 / 25%); color: var(--dsw-alias-state-success-primary, rgb(145 210 174)); }
.dshLiveTeamsTaskStage[data-status='waiting'][data-route='review'] .dshLiveTeamsTaskStatus { background: rgb(113 80 168 / 22%); border-color: rgb(155 123 203 / 30%); color: rgb(199 178 236); }
.dshLiveTeamsTaskStage[data-status='needs_human'] .dshLiveTeamsTaskStatus { color: var(--dsw-alias-state-warn-primary, rgb(223 186 130)); border-color: rgb(193 148 77 / 30%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskQueued { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsTaskFirst .dshLiveTeamsTaskRound { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsTaskEmpty { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 12px; color: var(--dsw-alias-label-tertiary); border: 1px dashed color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); border-radius: 6px; }
.dshLiveTeamsTaskEmpty p { margin: 0; font-size: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers > .dshLiveTeamsAddButton { margin: 0; grid-column: 2; font-size: 11px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMembers > .dshLiveTeamsMessage { grid-column: 1 / -1; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 8px; grid-column: 1 / -1; margin: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRows > .dshLiveTeamsRow { min-width: 0; max-width: none; padding: 0; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); border-radius: 7px; background: linear-gradient(145deg, rgb(255 255 255 / 2%), transparent), var(--dsw-alias-bg-layer-1); box-shadow: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsRowSelected { border-color: var(--dsh-team-accent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberCollapsed { display: grid; grid-template-columns: 32px minmax(0, 1fr) 10px; align-items: start; box-sizing: border-box; padding: 12px; gap: 6px 10px; border-radius: 7px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberCollapsed:hover { background: rgb(255 255 255 / 3%); }
.dshLiveTeamsMemberAvatar { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid rgb(255 255 255 / 7%); border-radius: 50%; background: rgb(255 255 255 / 5%); color: var(--dsw-alias-label-secondary); }
/* Hue identifies declared responsibility only; Session liveness stays in its own indicator. */
.dshLiveTeamsMemberAvatar[data-agent-role='lead'] { --dsh-agent-hue: rgb(218 171 92); }
.dshLiveTeamsMemberAvatar[data-agent-role='builder'] { --dsh-agent-hue: rgb(109 159 226); }
.dshLiveTeamsMemberAvatar[data-agent-role='reviewer'] { --dsh-agent-hue: rgb(177 139 222); }
.dshLiveTeamsMemberAvatar[data-agent-role='verifier'] { --dsh-agent-hue: rgb(89 181 163); }
.dshLiveTeamsMemberAvatar[data-agent-role='oracle'] { --dsh-agent-hue: rgb(100 187 210); }
.dshLiveTeamsMemberAvatar[data-agent-role='researcher'] { --dsh-agent-hue: rgb(148 151 220); }
.dshLiveTeamsMemberAvatar[data-agent-role='scout'] { --dsh-agent-hue: rgb(217 151 112); }
.dshLiveTeamsMemberAvatar[data-agent-role='delegate'] { --dsh-agent-hue: rgb(143 164 186); }
.dshLiveTeamsMemberAvatar[data-agent-role]:not([data-agent-role='custom']) { color: color-mix(in srgb, var(--dsh-agent-hue) 78%, var(--dsw-alias-label-primary)); background: color-mix(in srgb, var(--dsh-agent-hue) 12%, var(--dsw-alias-bg-layer-1)); border-color: color-mix(in srgb, var(--dsh-agent-hue) 28%, transparent); }
.dshLiveTeamsMemberCopy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberName { min-width: 0; font-weight: 550; overflow: hidden; text-overflow: ellipsis; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberChip { align-self: flex-start; padding: 0; background: none; color: var(--dsw-alias-label-tertiary); font-weight: 400; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberLive { font-size: 10px; font-weight: 400; white-space: nowrap; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberLiveOn { color: var(--dsw-alias-state-success-primary, rgb(113 195 149)); }
.dshLiveTeamsMemberMenu { color: var(--dsw-alias-label-tertiary); font-size: 17px; line-height: 16px; }
.dshLiveTeamsMemberPaused { grid-column: 2; color: rgb(216 179 124); font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberTask { grid-column: 1 / -1; margin: 5px 0 0; padding-top: 9px; border-top: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 65%, transparent); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 17px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsMemberNote { grid-column: 1 / -1; margin: 0; min-width: 0; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalList { max-height: min(65vh, 800px); gap: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRow { padding: 9px 0; border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 65%, transparent); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRow:last-child { border-bottom: 0; }
.dshLiveTeamsActivityModes { display: flex; align-items: center; gap: 5px; margin-left: auto; padding: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes .dshLiveTeamsSegmentedButton { min-width: 60px; padding: 5px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px; font-size: 10px; background: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes .dshLiveTeamsSegmentedButtonActive { color: var(--dsh-team-accent); border-color: var(--dsh-team-accent); background: rgb(237 135 83 / 5%); }
.dshLiveTeamsActivityCategories { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsActivityCategories > summary { cursor: pointer; padding: 5px; }
.dshLiveTeamsActivityCategories[open] { flex-basis: 100%; }
.dshLiveTeamsActivityCategories .dshLiveTeamsJournalFilters { justify-content: flex-start; margin: 6px 0 0; width: fit-content; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalLine { position: relative; display: grid; width: 100%; grid-template-columns: 32px minmax(0, 1fr) auto 14px; gap: 3px 12px; align-items: center; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon { grid-column: 1; grid-row: 1 / 3; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: rgb(208 176 126); background: rgb(164 126 66 / 14%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-task { color: rgb(136 197 162); background: rgb(59 140 93 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-message { color: rgb(148 182 219); background: rgb(62 121 174 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalIcon-review { color: rgb(189 167 223); background: rgb(123 82 176 / 17%); }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalKind { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); padding: 0; border: 0; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalSummary { grid-column: 2; grid-row: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 19px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRefs { grid-column: 2; grid-row: 2; display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 17px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTaskRef { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalRoundRef { flex: none; white-space: nowrap; font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTaskId { display: none; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalTime { grid-column: 3; grid-row: 1 / 3; color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsTaskFirst .dshLiveTeamsJournalDisclosure { grid-column: 4; grid-row: 1 / 3; }
.dshLiveTeamsJournalSourceSummary { margin: 0; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsDrawerBackdrop { position: fixed; inset: 0; z-index: 900; display: flex; justify-content: flex-end; background: rgb(0 0 0 / 38%); }
.dshLiveTeamsDrawer { display: flex; flex-direction: column; box-sizing: border-box; width: min(520px, 100%); height: 100%; padding-top: var(--dsh-frame-overlay-top, 0px); min-width: 0; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-left: 1px solid var(--dsw-alias-border-l2); box-shadow: -12px 0 40px rgb(0 0 0 / 18%); }
.dshLiveTeamsDrawerHeader { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsDrawerHeader h3 { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
.dshLiveTeamsDrawerHeader .dshLiveTeamsIconButton { font-size: 22px; }
.dshLiveTeamsDrawerBody { padding: 16px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.dshLiveTeamsDrawerBody > .dshLiveTeamsTeamControls { margin: 0; padding: 0; border: 0; background: transparent; }
.dshLiveTeamsDrawerBody .dshLiveTeamsHeader { flex-wrap: wrap; }
.dshLiveTeamsDrawerBody .dshLiveTeamsLeadControl { flex-basis: 100%; margin-left: 0; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberPanel { margin: 0; padding: 14px; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberIdentity { flex-wrap: wrap; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMetaValue { overflow-wrap: anywhere; }
.dshLiveTeamsSettingsToggle:focus-visible, .dshLiveTeamsMemberCollapsed:focus-visible, .dshLiveTeamsActivityCategories > summary:focus-visible { outline: 2px solid var(--dsh-team-accent); outline-offset: 2px; }
@container dshLiveTeamsCard (max-width: 700px) {
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskSummary { grid-template-columns: 32px minmax(0, 1fr) 86px; gap: 10px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskDisclosure { grid-column: 1; grid-row: 1 / 4; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskIdentity { grid-column: 2; grid-row: 1; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskOwner { grid-column: 2; grid-row: 2; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskStage { grid-column: 2; grid-row: 3; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskAge { grid-column: 3; grid-row: 1; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskRound { grid-column: 3; grid-row: 2; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsTaskFilter { gap: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsDispatchToggle { flex-basis: 100%; text-align: left; }
}
@media (max-width: 600px) {
  .dshLiveTeamsTaskFirst { padding: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsMain > .dshLiveTeamsCard { padding: 12px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsSummaryGrid { flex-basis: 100%; order: 3; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsSummary { gap: 8px; }
  .dshLiveTeamsTaskFirst .dshLiveTeamsActivityModes { margin-left: 0; flex-wrap: wrap; }
}

/* Member settings: clear sections rather than a nested role-colored roster card. */
.dshLiveTeamsMemberFeedback { position: sticky; top: 0; z-index: 2; margin: 0 0 14px; padding: 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
.dshLiveTeamsDrawerBody .dshLiveTeamsMemberPanel.dshLiveTeamsMemberSettings { display: flex; flex-direction: column; align-items: stretch; gap: 0; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
.dshLiveTeamsMemberSettings > .dshLiveTeamsMemberHeading { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 12px; padding: 2px 0 20px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberHeading > .dshLiveTeamsMemberAvatar { width: 44px; height: 44px; box-sizing: border-box; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberHeading > .dshLiveTeamsMemberAvatar svg { width: 25px; height: 25px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberIdentity { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberAction { min-width: 0; max-width: 100%; padding: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberName { font-size: 16px; font-weight: 600; line-height: 23px; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberRoleCaption { flex: 1 1 100%; order: 1; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsState { flex: 1 1 100%; order: 2; font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsNameInput { flex: 1 1 100%; width: 100%; min-width: 0; max-width: 100%; }
.dshLiveTeamsMemberSettings .dshLiveTeamsNameActions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsEditNameButton { flex: none; opacity: 1; }
.dshLiveTeamsMemberSection { display: flex; flex-direction: column; align-items: stretch; gap: 9px; margin: 0; padding: 18px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberSettings h4 { margin: 0; font-size: 12px; font-weight: 600; line-height: 18px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsSectionHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 400; line-height: 17px; white-space: normal; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsControls { display: flex; flex-wrap: nowrap; align-items: flex-end; gap: 8px; width: 100%; margin: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsRoleField { display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsRoleInput { box-sizing: border-box; max-width: 100%; min-width: 0; height: 34px; border-radius: 6px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsApply { flex: none; min-height: 32px; }
.dshLiveTeamsDraftHint { margin: 0; font-size: 10px; line-height: 16px; color: var(--dsw-alias-state-warn-primary); }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberActions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin: 2px 0 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsAvailabilityAction { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; width: auto; height: 32px; padding: 5px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; font-size: 11px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsMemberSettings .dshLiveTeamsContactGrant { display: flex; flex-direction: column; align-items: stretch; gap: 10px; flex-basis: auto; margin: 0; }
.dshLiveTeamsContactChips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dshLiveTeamsContactChip { display: inline-flex; align-items: center; max-width: 100%; padding: 4px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 15px; overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsGrantControls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsContactSelect { flex: 1 1 100%; width: 100%; margin-bottom: 2px; }
.dshLiveTeamsMemberSessionActions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.dshLiveTeamsBindingTag { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberOpen { display: inline-flex; justify-content: center; padding: 6px 11px; min-height: 30px; font-size: 11px; border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dshLiveTeamsMemberTurnControl { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; margin-top: 4px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsInterruptButton { align-self: flex-start; padding: 6px 10px; font-size: 11px; }
.dshLiveTeamsMemberNoteText { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshLiveTeamsMemberTechnical { padding: 14px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberTechnical > summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 20px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 14px 0 0; padding: 0; border: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta dt { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta dd { margin: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberMeta code { white-space: normal; overflow-wrap: anywhere; user-select: all; }
.dshLiveTeamsMemberRemoval { display: flex; flex-direction: column; align-items: flex-start; gap: 9px; padding: 18px 0 2px; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsMemberSettings .dshLiveTeamsMemberRemove { margin: 1px 0 0; padding: 6px 10px; font-size: 11px; }

/* B43: rotation limits. Laid out like the lead control: a team-level setting above the roster. */
.dshLiveTeamsRotation { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dshLiveTeamsRotationHead { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dshLiveTeamsRotationHead strong { font-size: 12px; color: var(--dsw-alias-label-primary); }
.dshLiveTeamsRotationState { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshLiveTeamsRotationHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }
.dshLiveTeamsRotationControls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.dshLiveTeamsRotationControls .dshLiveTeamsModalField { flex: 0 1 150px; }
.dshLiveTeamsRotationControls .dshLiveTeamsModalField input { width: 100%; }
.dshLiveTeamsRotationToggle { padding: 6px 11px; font-size: 11px; min-height: 30px; }
.dshLiveTeamsMemberTechnical > summary:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; border-radius: 3px; }
`

export function installLiveTeamsStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const selector = `style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`
  if (document.querySelector(selector) !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-live-teams'
  style.dataset.pluginCss = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
  return () => { style.remove() }
}
