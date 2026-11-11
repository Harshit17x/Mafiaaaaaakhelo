import React, { useEffect, useRef, useState } from 'react';
import {
  AVATAR_PRESETS,
  MAX_AVATAR_CAPTION_LENGTH,
  MAX_CUSTOM_AVATAR_DATA_URL_LENGTH,
  createDefaultAvatarConfig,
  sanitizeAvatarCaption,
} from '@midnight-city/shared';
import type {
  AvatarFilter,
  AvatarFrameTint,
  AvatarPinColor,
  PlayerAvatarConfig,
} from '@midnight-city/shared';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import {
  AvatarPolaroidCard,
  AvatarPushpinSvg,
  resolveAvatarLabel,
} from './AvatarPolaroidCard';
import { useGameStore } from '../stores/useGameStore';

const FILTER_OPTIONS: { id: AvatarFilter; label: string }[] = [
  { id: 'color', label: 'Original' },
  { id: 'noir', label: 'Noir B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vivid', label: 'Vivid' },
];

const FRAME_OPTIONS: { id: AvatarFrameTint; label: string; swatchClass: string }[] = [
  { id: 'cream', label: 'Classic', swatchClass: 'bg-[#ebe6dc] border-[#cfc7b8]' },
  { id: 'aged', label: 'Aged', swatchClass: 'bg-[#dac49d] border-[#b59769]' },
  { id: 'charcoal', label: 'Noir', swatchClass: 'bg-[#1a1d28] border-[#4f5870]' },
  { id: 'gold', label: 'Gilded', swatchClass: 'bg-[#e6cc8a] border-[#b98e39]' },
];

const PIN_OPTIONS: { id: AvatarPinColor; label: string }[] = [
  { id: 'green', label: 'Forest' },
  { id: 'white', label: 'Chalk' },
  { id: 'red', label: 'Crimson' },
  { id: 'teal', label: 'Teal' },
  { id: 'gold', label: 'Amber' },
];

async function resizeImageFileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });

    const minSide = Math.max(1, Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const sx = ((img.naturalWidth || img.width) - minSide) / 2;
    const sy = ((img.naturalHeight || img.height) - minSide) / 2;

    const sizes = [220, 180, 140];
    const qualities = [0.82, 0.68, 0.52];

    for (let i = 0; i < sizes.length; i += 1) {
      const targetSize = sizes[i] ?? 180;
      const quality = qualities[i] ?? 0.65;
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Image processing unavailable in this browser.');
      }
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_CUSTOM_AVATAR_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
    throw new Error('Image is too large even after compression. Try a simpler image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AvatarPanelModal() {
  const avatarOpen = useGameStore((s) => s.avatarOpen);
  const avatarFlowTarget = useGameStore((s) => s.avatarFlowTarget);
  const myAvatar = useGameStore((s) => s.myAvatar);
  const setAvatarOpen = useGameStore((s) => s.setAvatarOpen);
  const completeAvatarFlow = useGameStore((s) => s.completeAvatarFlow);
  const updateAvatar = useGameStore((s) => s.updateAvatar);

  const [draft, setDraft] = useState<PlayerAvatarConfig>(myAvatar);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (avatarOpen) {
      setDraft(myAvatar);
      setUploadError(null);
    }
  }, [avatarOpen, myAvatar]);

  useEffect(() => {
    if (!avatarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAvatarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [avatarOpen, setAvatarOpen]);

  if (!avatarOpen) {
    return null;
  }

  const handleSaveAndClose = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAvatar(draft);
      if (avatarFlowTarget) {
        completeAvatarFlow();
      } else {
        setAvatarOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPreset = (presetId: (typeof AVATAR_PRESETS)[number]['id']) => {
    const meta = AVATAR_PRESETS.find((p) => p.id === presetId);
    if (!meta) return;
    setUploadError(null);
    setDraft((prev) => ({
      ...prev,
      presetId: meta.id,
      filter: meta.defaultFilter,
      pinColor: meta.defaultPin,
      tilt: meta.defaultTilt,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }));
  };

  const handleRandomize = () => {
    const preset = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)] ?? AVATAR_PRESETS[0]!;
    const filter = FILTER_OPTIONS[Math.floor(Math.random() * FILTER_OPTIONS.length)]?.id ?? 'color';
    const frameTint = FRAME_OPTIONS[Math.floor(Math.random() * FRAME_OPTIONS.length)]?.id ?? 'cream';
    const pinColor = PIN_OPTIONS[Math.floor(Math.random() * PIN_OPTIONS.length)]?.id ?? 'green';
    const tilt = Math.round((Math.random() * 8 - 4) * 2) / 2;
    setUploadError(null);
    setDraft((prev) => ({
      ...prev,
      presetId: preset.id,
      filter,
      frameTint,
      pinColor,
      tilt,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }));
  };

  const handleReset = () => {
    setUploadError(null);
    if (draft.presetId === 'custom') {
      setDraft((prev) => ({
        ...createDefaultAvatarConfig(),
        presetId: prev.customDataUrl ? 'custom' : 'spiky-kid',
        customDataUrl: prev.customDataUrl,
      }));
      return;
    }
    const meta = AVATAR_PRESETS.find((p) => p.id === draft.presetId) ?? AVATAR_PRESETS[0]!;
    setDraft({
      presetId: meta.id,
      filter: meta.defaultFilter,
      pinColor: meta.defaultPin,
      frameTint: 'cream',
      tilt: meta.defaultTilt,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      caption: '',
      customDataUrl: draft.customDataUrl,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please pick a PNG, JPG, or WebP image file.');
      return;
    }
    try {
      setUploadError(null);
      const dataUrl = await resizeImageFileToDataUrl(file);
      setDraft((prev) => ({
        ...prev,
        presetId: 'custom',
        customDataUrl: dataUrl,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to load image.');
    }
  };

  const activeLabel = resolveAvatarLabel(draft);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Customize Player Avatar"
    >
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden rounded-xl border border-[#e3b963]/35 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#14110f]">
        {/* Top Reference-Style Bar */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 bg-[#14110f] pr-3 sm:pr-5 border-b border-black/60">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAvatarOpen(false)}
              className="inline-flex items-center gap-1.5 bg-[#f4f1ea] hover:bg-white active:scale-[0.98] text-[#171310] font-condensed font-black uppercase tracking-wide text-sm sm:text-base px-5 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
              <span>BACK</span>
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2">
              {avatarFlowTarget && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200 font-bold">
                  Step 1 of 2 • {avatarFlowTarget === 'create' ? 'Create Room' : 'Join Room'}
                </span>
              )}
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-cream-300">
                Active: <strong className="text-gold-300">{activeLabel}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 py-2 pl-2">
            <button
              type="button"
              onClick={handleRandomize}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#271b15] hover:bg-[#36241b] border border-gold-500/35 text-xs font-condensed font-bold uppercase tracking-wider text-gold-200 transition cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Randomize
            </button>

            <button
              type="button"
              onClick={() => void handleSaveAndClose()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-gradient-to-r from-[#148653] to-[#1aa366] hover:brightness-110 border border-emerald-300/50 text-xs sm:text-sm font-condensed font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-60 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Saving...</span>
                </>
              ) : avatarFlowTarget ? (
                <>
                  <span>
                    {avatarFlowTarget === 'create' ? 'Continue to Room Settings' : 'Continue to Alias'}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Equip Avatar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Folded / Torn Paper Scrap Accent under Header matching reference */}
        <div className="relative flex-1 min-h-0 grid lg:grid-cols-12 max-lg:overflow-y-auto max-lg:overflow-x-hidden lg:overflow-hidden pinboard-scroll">
          {/* LEFT: Brown Diamond Polaroid Pinboard */}
          <div className="relative lg:col-span-7 xl:col-span-8 pinboard-surface flex flex-col lg:min-h-0">
            {/* Decorative Folded Paper Scraps along Top Edge */}
            <svg
              viewBox="0 0 900 32"
              preserveAspectRatio="none"
              className="pointer-events-none absolute top-0 inset-x-0 w-full h-6 sm:h-7 z-10 opacity-95"
              aria-hidden="true"
            >
              <polygon points="105,0 148,0 132,12 118,22 108,8" fill="#d9d5cc" />
              <polygon points="108,0 120,0 116,14" fill="#f4f1ea" />
              <polygon points="430,0 640,0 595,24 530,11 475,20" fill="#cbc6bc" />
              <polygon points="445,0 620,0 580,17 520,7" fill="#efece4" />
            </svg>

            <div className="relative z-10 px-5 sm:px-8 pt-6 pb-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-condensed font-black italic text-2xl sm:text-3xl tracking-wider text-[#271209] drop-shadow-[0_1px_0_rgba(245,223,176,0.25)]">
                  AVATARS <span className="text-lg align-middle not-italic">▼</span>
                </h2>
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#ecd8be]/80 mt-0.5">
                  Pin a dossier portrait &amp; customize its Polaroid card
                </p>
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-[#261108]/60 border border-[#f5dfb0]/20 text-gold-200">
                {AVATAR_PRESETS.length} Crew + Custom
              </span>
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto overflow-x-hidden pinboard-scroll px-5 sm:px-8 pt-4 pb-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 sm:gap-6 items-start">
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = draft.presetId === preset.id;
                  const cardAvatar: PlayerAvatarConfig = isSelected
                    ? draft
                    : {
                        presetId: preset.id,
                        filter: preset.defaultFilter,
                        pinColor: preset.defaultPin,
                        frameTint: 'cream',
                        tilt: preset.defaultTilt,
                        zoom: 1,
                        offsetX: 0,
                        offsetY: 0,
                        caption: '',
                        customDataUrl: null,
                      };

                  return (
                    <div key={preset.id} className="flex flex-col items-center gap-1.5">
                      <AvatarPolaroidCard
                        avatar={cardAvatar}
                        selected={isSelected}
                        showPin
                        showEquippedBadge
                        size="board"
                        title={`${preset.name} — ${preset.tagline}`}
                        onClick={() => handleSelectPreset(preset.id)}
                      />
                      <span
                        className={`text-[11px] font-condensed uppercase tracking-wider px-2 py-0.5 rounded transition ${
                          isSelected
                            ? 'bg-emerald-900/90 text-emerald-200 font-bold border border-emerald-400/50'
                            : 'text-[#f3e3cc]/85 font-semibold'
                        }`}
                      >
                        {preset.name}
                      </span>
                    </div>
                  );
                })}

                {/* Custom Photo Polaroid Slot */}
                <div className="flex flex-col items-center gap-1.5">
                  <AvatarPolaroidCard
                    avatar={{
                      ...draft,
                      presetId: 'custom',
                      pinColor: draft.presetId === 'custom' ? draft.pinColor : 'gold',
                      tilt: draft.presetId === 'custom' ? draft.tilt : 2.1,
                      filter: draft.presetId === 'custom' ? draft.filter : 'color',
                      frameTint: draft.presetId === 'custom' ? draft.frameTint : 'cream',
                      caption: draft.presetId === 'custom' ? draft.caption : '',
                    }}
                    selected={draft.presetId === 'custom'}
                    emptyCustomSlot={!draft.customDataUrl}
                    showPin
                    showEquippedBadge
                    size="board"
                    title="Upload your own custom PNG/JPG portrait"
                    onClick={() => {
                      if (draft.customDataUrl && draft.presetId !== 'custom') {
                        setDraft((prev) => ({
                          ...prev,
                          presetId: 'custom',
                          zoom: 1,
                          offsetX: 0,
                          offsetY: 0,
                        }));
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                  />
                  <span
                    className={`text-[11px] font-condensed uppercase tracking-wider px-2 py-0.5 rounded transition ${
                      draft.presetId === 'custom'
                        ? 'bg-emerald-900/90 text-emerald-200 font-bold border border-emerald-400/50'
                        : 'text-[#f3e3cc]/85 font-semibold'
                    }`}
                  >
                    {draft.customDataUrl ? 'Your Photo' : 'Custom Upload'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Customize Studio Workbench */}
          <div className="lg:col-span-5 xl:col-span-4 bg-[#1c120d] border-t lg:border-t-0 lg:border-l border-gold-500/20 flex flex-col lg:min-h-0 lg:overflow-y-auto overflow-x-hidden pinboard-scroll p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-gold-300">
                <SlidersHorizontal className="w-4 h-4" />
                <h3 className="font-display text-sm uppercase tracking-widest">
                  Polaroid Studio
                </h3>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-cream-300 hover:text-gold-200 px-2 py-1 rounded border border-gold-500/20 hover:border-gold-400/45 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Live Preview Stage */}
            <div className="pinboard-surface rounded-lg border border-gold-500/25 p-4 pt-6 flex flex-col items-center justify-center relative shadow-inner">
              <AvatarPolaroidCard
                avatar={draft}
                selected
                showPin
                showEquippedBadge
                size="preview"
                title={activeLabel}
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#271811]/95 hover:bg-[#3a2419] border border-gold-400/40 text-xs font-semibold text-gold-200 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {draft.customDataUrl ? 'Replace Custom Photo' : 'Upload Own Image'}
                </button>
              </div>

              {uploadError && (
                <p className="mt-2 text-xs text-crimson-300 bg-crimson-950/80 border border-crimson-500/50 rounded px-2.5 py-1 text-center">
                  {uploadError}
                </p>
              )}
            </div>

            {/* Photo Filter */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cream-300">
                Film Look
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, filter: opt.id }))}
                    className={`py-1.5 px-1.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                      draft.filter === opt.id
                        ? 'bg-gold-500/25 border-gold-300 text-gold-200'
                        : 'bg-noir-900/70 border-gold-500/20 text-cream-300 hover:border-gold-400/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Tint & Pushpin Color */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cream-300">
                  Polaroid Stock
                </div>
                <div className="flex items-center gap-1.5">
                  {FRAME_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      aria-label={`${opt.label} Polaroid frame`}
                      onClick={() => setDraft((prev) => ({ ...prev, frameTint: opt.id }))}
                      className={`w-8 h-8 rounded border-2 flex items-center justify-center transition cursor-pointer ${opt.swatchClass} ${
                        draft.frameTint === opt.id
                          ? 'ring-2 ring-gold-300 scale-105'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {draft.frameTint === opt.id && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cream-300">
                  Pushpin
                </div>
                <div className="flex items-center gap-1">
                  {PIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={`${opt.label} Pushpin`}
                      aria-label={`${opt.label} pushpin`}
                      onClick={() => setDraft((prev) => ({ ...prev, pinColor: opt.id }))}
                      className={`p-1 rounded border transition cursor-pointer ${
                        draft.pinColor === opt.id
                          ? 'bg-gold-500/25 border-gold-300 scale-105'
                          : 'bg-noir-900/60 border-transparent hover:border-gold-500/30'
                      }`}
                    >
                      <AvatarPushpinSvg color={opt.id} className="w-6 h-6" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Handwritten Chin Caption */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-cream-300">
                <span>Card Note</span>
                <span className="text-cream-400">
                  {draft.caption.length}/{MAX_AVATAR_CAPTION_LENGTH}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={MAX_AVATAR_CAPTION_LENGTH}
                  value={draft.caption}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      caption: sanitizeAvatarCaption(e.target.value),
                    }))
                  }
                  placeholder="Optional alias note (e.g. The Don)"
                  className="w-full rounded-lg bg-noir-950/90 border border-gold-500/30 focus:border-gold-300 pl-3 pr-8 py-1.5 text-xs text-cream-50 placeholder-cream-400/50 focus:outline-none"
                />
                {draft.caption && (
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, caption: '' }))}
                    aria-label="Clear note"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-cream-400 hover:text-cream-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sliders: Zoom, Tilt, Pan X, Pan Y */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-1 border-t border-gold-500/15">
              <label className="space-y-1 text-[11px] font-mono text-cream-300">
                <div className="flex justify-between">
                  <span>ZOOM</span>
                  <span className="text-gold-300">{draft.zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={1.5}
                  step={0.05}
                  value={draft.zoom}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, zoom: Number(e.target.value) }))
                  }
                  className="w-full accent-gold-400"
                />
              </label>

              <label className="space-y-1 text-[11px] font-mono text-cream-300">
                <div className="flex justify-between">
                  <span>PIN TILT</span>
                  <span className="text-gold-300">{draft.tilt > 0 ? `+${draft.tilt}` : draft.tilt}°</span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={0.5}
                  value={draft.tilt}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, tilt: Number(e.target.value) }))
                  }
                  className="w-full accent-gold-400"
                />
              </label>

              <label className="space-y-1 text-[11px] font-mono text-cream-300">
                <div className="flex justify-between">
                  <span>PAN X</span>
                  <span className="text-gold-300">{draft.offsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  step={1}
                  value={draft.offsetX}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, offsetX: Number(e.target.value) }))
                  }
                  className="w-full accent-gold-400"
                />
              </label>

              <label className="space-y-1 text-[11px] font-mono text-cream-300">
                <div className="flex justify-between">
                  <span>PAN Y</span>
                  <span className="text-gold-300">{draft.offsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  step={1}
                  value={draft.offsetY}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, offsetY: Number(e.target.value) }))
                  }
                  className="w-full accent-gold-400"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
