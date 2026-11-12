import { soundEngine } from './SoundEngine';

export type UiSfxKind =
  | 'none'
  | 'hover'
  | 'shift'
  | 'click'
  | 'confirm'
  | 'back'
  | 'toggle'
  | 'tab'
  | 'modalOpen'
  | 'modalClose'
  | 'cardSelect'
  | 'chip';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[data-sfx]',
].join(', ');

const KEY_NAV_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

const BACK_PATTERN =
  /\b(close|cancel|back|leave|exit|mute|unmute|dismiss|skip|clear|remove|delete|return|minimize)\b/i;

const CONFIRM_PATTERN =
  /\b(submit|confirm|deal|create|join|vote|ready|start|open table|enter table|save|equip|apply|play again|acknowledge|lock)\b/i;

function isControlDisabled(el: HTMLElement): boolean {
  if ('disabled' in el && Boolean((el as HTMLButtonElement).disabled)) {
    return true;
  }
  if (el.hasAttribute('disabled')) {
    return true;
  }
  if (el.getAttribute('aria-disabled') === 'true') {
    return true;
  }
  if (el.closest('[aria-disabled="true"], fieldset[disabled]')) {
    return true;
  }
  return false;
}

function findInteractiveControl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(INTERACTIVE_SELECTOR);
  if (!(control instanceof HTMLElement)) return null;
  if (isControlDisabled(control)) return null;
  return control;
}

function getExplicitSfx(control: HTMLElement): UiSfxKind | null {
  const own = control.getAttribute('data-sfx') as UiSfxKind | null;
  if (own) return own;
  const suppressedAncestor = control.closest('[data-sfx="none"]');
  if (suppressedAncestor) return 'none';
  return null;
}

function playByKind(kind: UiSfxKind): void {
  switch (kind) {
    case 'none':
      return;
    case 'hover':
      soundEngine.playUiHover();
      return;
    case 'shift':
      soundEngine.playUiShift();
      return;
    case 'click':
      soundEngine.playUiClick();
      return;
    case 'confirm':
      soundEngine.playUiConfirm();
      return;
    case 'back':
      soundEngine.playUiBack();
      return;
    case 'toggle':
      soundEngine.playUiToggle();
      return;
    case 'tab':
      soundEngine.playUiTab();
      return;
    case 'modalOpen':
      soundEngine.playUiModalOpen();
      return;
    case 'modalClose':
      soundEngine.playUiModalClose();
      return;
    case 'cardSelect':
      soundEngine.playCardSelect();
      return;
    case 'chip':
      soundEngine.playChipClink();
      return;
  }
}

function classifyControlClick(control: HTMLElement): UiSfxKind {
  const role = control.getAttribute('role');
  if (role === 'tab' || control.hasAttribute('aria-selected')) {
    return 'tab';
  }

  if (
    control instanceof HTMLInputElement &&
    (control.type === 'checkbox' || control.type === 'radio')
  ) {
    return 'toggle';
  }

  if (
    role === 'switch' ||
    role === 'checkbox' ||
    role === 'radio' ||
    control.hasAttribute('aria-pressed')
  ) {
    return 'toggle';
  }

  const label = [
    control.getAttribute('aria-label') ?? '',
    control.getAttribute('title') ?? '',
    control.textContent ?? '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (BACK_PATTERN.test(label)) {
    return 'back';
  }

  if (
    (control instanceof HTMLButtonElement && control.type === 'submit') ||
    (control instanceof HTMLInputElement && control.type === 'submit') ||
    CONFIRM_PATTERN.test(label)
  ) {
    return 'confirm';
  }

  return 'click';
}

export function mountUiSoundDelegator(): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let lastHoveredEl: HTMLElement | null = null;
  let lastFocusedEl: HTMLElement | null = null;
  let lastPointerDownEl: HTMLElement | null = null;
  let lastPointerDownAt = -Infinity;
  let lastKeyNavAt = -Infinity;

  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const control = findInteractiveControl(e.target);
    if (!control) return;

    if (control === lastHoveredEl) return;
    if (e.relatedTarget instanceof Node && control.contains(e.relatedTarget)) {
      return;
    }

    lastHoveredEl = control;

    const explicit = getExplicitSfx(control);
    if (explicit === 'none') return;

    const hoverAttr =
      control.getAttribute('data-sfx-hover') ??
      control.closest('[data-sfx-hover]')?.getAttribute('data-sfx-hover');

    if (hoverAttr === 'none') return;
    if (hoverAttr === 'card') {
      soundEngine.playCardHover();
    } else {
      soundEngine.playUiHover();
    }
  };

  const onPointerOut = (e: PointerEvent) => {
    if (!lastHoveredEl) return;
    if (!(e.target instanceof Node) || !lastHoveredEl.contains(e.target)) return;
    if (e.relatedTarget instanceof Node && lastHoveredEl.contains(e.relatedTarget)) return;
    lastHoveredEl = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    void soundEngine.unlock();
    lastPointerDownAt = performance.now();
    lastPointerDownEl = findInteractiveControl(e.target);
  };

  const onTouchStart = () => {
    void soundEngine.unlock();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    void soundEngine.unlock();
    if (KEY_NAV_KEYS.has(e.key)) {
      lastKeyNavAt = performance.now();
    }
  };

  const onFocusIn = (e: FocusEvent) => {
    const control = findInteractiveControl(e.target);
    if (!control) return;
    if (control === lastFocusedEl) return;

    const now = performance.now();
    const samePointerTarget =
      lastPointerDownEl !== null &&
      (lastPointerDownEl === control ||
        lastPointerDownEl.contains(control) ||
        control.contains(lastPointerDownEl));

    if (samePointerTarget && now - lastPointerDownAt < 500) {
      lastFocusedEl = control;
      return;
    }

    if (lastPointerDownAt > lastKeyNavAt && now - lastPointerDownAt < 350) {
      lastFocusedEl = control;
      return;
    }

    lastFocusedEl = control;

    const explicit = getExplicitSfx(control);
    if (explicit === 'none') return;

    soundEngine.playUiShift();
  };

  const onClick = (e: MouseEvent) => {
    void soundEngine.unlock();

    const control = findInteractiveControl(e.target);
    if (!control) return;

    const explicit = getExplicitSfx(control);
    if (explicit === 'none') return;

    if (explicit) {
      playByKind(explicit);
      return;
    }

    const kind = classifyControlClick(control);
    playByKind(kind);
  };

  const onChange = (e: Event) => {
    if (!(e.target instanceof HTMLSelectElement)) return;
    if (isControlDisabled(e.target)) return;
    const explicit = getExplicitSfx(e.target);
    if (explicit === 'none') return;
    soundEngine.playUiToggle();
  };

  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('pointerout', onPointerOut, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);

  return () => {
    document.removeEventListener('pointerover', onPointerOver, true);
    document.removeEventListener('pointerout', onPointerOut, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('touchstart', onTouchStart, { capture: true });
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
    lastHoveredEl = null;
    lastFocusedEl = null;
    lastPointerDownEl = null;
  };
}
