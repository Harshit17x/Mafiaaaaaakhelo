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
  '[data-sfx]:not([data-sfx="none"])',
].join(', ');

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
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return null;
  const control = el.closest(INTERACTIVE_SELECTOR);
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
    playByKind(kind === 'hover' || kind === 'shift' ? 'click' : kind);
  };

  const onPointerDown = () => {
    void soundEngine.unlock();
  };

  const onTouchStart = () => {
    void soundEngine.unlock();
  };

  const onKeyDown = () => {
    void soundEngine.unlock();
  };

  const onChange = (e: Event) => {
    if (!(e.target instanceof HTMLSelectElement)) return;
    if (isControlDisabled(e.target)) return;
    const explicit = getExplicitSfx(e.target);
    if (explicit === 'none') return;
    soundEngine.playUiClick();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('touchstart', onTouchStart, { capture: true });
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
  };
}
