"use client";

import { DefaultMainMenu, EditSubmenu, ViewSubmenu, ExportFileContentSubMenu, ExtrasGroup,
  TldrawUiMenuGroup, TldrawUiMenuSubmenu, TldrawUiMenuItem, TldrawUiMenuCheckboxItem,
  ToggleSnapModeItem, ToggleToolLockItem, ToggleGridItem, ToggleWrapModeItem, ToggleFocusModeItem,
  ToggleEdgeScrollingItem, ToggleDynamicSizeModeItem, TogglePasteAtCursorItem, ToggleDebugModeItem,
  AccessibilityMenu, InputModeMenu, ColorSchemeMenu, LanguageMenu, KeyboardShortcutsMenuItem } from 'tldraw';
import { useBoardFiles } from './board-file-controls';
import { useBoardPreferences } from './board-preferences';

export function BoardMainMenu() {
  const files=useBoardFiles();
  const {axes,toggleAxes}=useBoardPreferences();
  return <>
    <DefaultMainMenu>
      <TldrawUiMenuGroup id="basic">
        <EditSubmenu /><ViewSubmenu /><ExportFileContentSubMenu /><ExtrasGroup />
        <TldrawUiMenuSubmenu id="board-file" label="Board file">
          <TldrawUiMenuItem id="download-board" label="Download board" readonlyOk onSelect={files.download} />
          <TldrawUiMenuItem id="restore-board" label="Restore board" disabled={files.readonly} onSelect={files.restoreFile} />
          <TldrawUiMenuItem id="recover-board" label="Recover copy" disabled={files.readonly} onSelect={files.recover} />
        </TldrawUiMenuSubmenu>
      </TldrawUiMenuGroup>
      <TldrawUiMenuGroup id="preferences">
        <TldrawUiMenuSubmenu id="preferences" label="menu.preferences">
          <TldrawUiMenuGroup id="preferences-actions">
            <ToggleSnapModeItem /><ToggleToolLockItem /><ToggleGridItem />
            <TldrawUiMenuCheckboxItem id="toggle-axes" label="Axes" checked={axes} readonlyOk onSelect={toggleAxes} />
            <ToggleWrapModeItem /><ToggleFocusModeItem /><ToggleEdgeScrollingItem />
            <ToggleDynamicSizeModeItem /><TogglePasteAtCursorItem /><ToggleDebugModeItem />
          </TldrawUiMenuGroup>
          <TldrawUiMenuGroup id="user-interface-submenus">
            <AccessibilityMenu /><InputModeMenu /><ColorSchemeMenu />
          </TldrawUiMenuGroup>
        </TldrawUiMenuSubmenu>
        <LanguageMenu /><KeyboardShortcutsMenuItem />
      </TldrawUiMenuGroup>
    </DefaultMainMenu>
    {files.controls}
  </>;
}
