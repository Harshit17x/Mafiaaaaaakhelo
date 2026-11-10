import React, { useId } from 'react';

interface MobsterPaperSceneProps {
  tiltX?: number;
  tiltY?: number;
  className?: string;
}

/**
 * Renders the 2D paper-cut mobster illustration split across 6 true CSS 3D
 * Z-depth planes (`translateZ`) so the fedora brim, lapels, hand, crystal
 * whiskey glass, and rising smoke physically pop out of the shadowbox frame.
 */
export function MobsterPaperScene({
  tiltX = 0,
  tiltY = 0,
  className = '',
}: MobsterPaperSceneProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const ids = {
    paperGrain: `mp-grain-${uid}`,
    shadowBack: `mp-sh-back-${uid}`,
    shadowMid: `mp-sh-mid-${uid}`,
    shadowCrisp: `mp-sh-crisp-${uid}`,
    shadowPop: `mp-sh-pop-${uid}`,
    softBokeh: `mp-bokeh-${uid}`,
    softShadow: `mp-softsh-${uid}`,
    smokeBlur: `mp-smoke-${uid}`,
    bgWall: `mp-bgwall-${uid}`,
    amberGlow: `mp-amber-${uid}`,
    frameGold: `mp-gold-${uid}`,
    suitBase: `mp-suit-${uid}`,
    lapelLeft: `mp-lapel-l-${uid}`,
    lapelRight: `mp-lapel-r-${uid}`,
    shirtGrad: `mp-shirt-${uid}`,
    skinLight: `mp-skin-${uid}`,
    handLight: `mp-hand-${uid}`,
    crownGrad: `mp-crown-${uid}`,
    brimTop: `mp-brim-${uid}`,
    whiskey: `mp-whiskey-${uid}`,
    tableWood: `mp-wood-${uid}`,
    smokeA: `mp-smoke-a-${uid}`,
    smokeB: `mp-smoke-b-${uid}`,
    pinLeft: `mp-pin-l-${uid}`,
    pinRight: `mp-pin-r-${uid}`,
    stubble: `mp-stubble-${uid}`,
    boxClip: `mp-clip-${uid}`,
  };

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ perspective: '1200px' }}
      aria-label="3D layered paper-cut illustration of the Midnight City mobster"
    >
      {/* Hidden shared SVG defs referenced cleanly across all 6 Z-depth SVG planes */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <filter id={ids.paperGrain} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" seed="14" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="
                0.16 0 0 0 0.84
                0 0.16 0 0 0.82
                0 0 0.16 0 0.79
                0 0 0 0.08 0"
              result="cardNoise"
            />
            <feComposite in="cardNoise" in2="SourceGraphic" operator="atop" result="textured" />
            <feBlend in="SourceGraphic" in2="textured" mode="multiply" />
          </filter>

          <filter id={ids.shadowBack} x="-20%" y="-20%" width="145%" height="145%">
            <feDropShadow dx="-8" dy="14" stdDeviation="12" floodColor="#020101" floodOpacity="0.86" />
          </filter>

          <filter id={ids.shadowMid} x="-18%" y="-18%" width="140%" height="140%">
            <feDropShadow dx="-6" dy="10" stdDeviation="7.5" floodColor="#040202" floodOpacity="0.82" />
          </filter>

          <filter id={ids.shadowCrisp} x="-15%" y="-15%" width="134%" height="134%">
            <feDropShadow dx="-4" dy="7" stdDeviation="4.5" floodColor="#050303" floodOpacity="0.76" />
          </filter>

          <filter id={ids.shadowPop} x="-24%" y="-24%" width="152%" height="152%">
            <feDropShadow dx="-12" dy="20" stdDeviation="16" floodColor="#000000" floodOpacity="0.94" />
          </filter>

          <filter id={ids.softBokeh} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          <filter id={ids.softShadow} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" />
          </filter>

          <filter id={ids.smokeBlur} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>

          <linearGradient id={ids.bgWall} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#19110c" />
            <stop offset="50%" stopColor="#110b08" />
            <stop offset="100%" stopColor="#070504" />
          </linearGradient>

          <radialGradient id={ids.amberGlow} cx="62%" cy="32%" r="60%">
            <stop offset="0%" stopColor="#dc8836" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#7c3e14" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0b0705" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={ids.frameGold} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5dfb0" stopOpacity="0.92" />
            <stop offset="48%" stopColor="#b38936" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#e8c67a" stopOpacity="0.88" />
          </linearGradient>

          <linearGradient id={ids.suitBase} x1="18%" y1="8%" x2="88%" y2="92%">
            <stop offset="0%" stopColor="#2c2723" />
            <stop offset="45%" stopColor="#1f1c19" />
            <stop offset="100%" stopColor="#110f0d" />
          </linearGradient>

          <linearGradient id={ids.lapelLeft} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312b27" />
            <stop offset="100%" stopColor="#1b1815" />
          </linearGradient>

          <linearGradient id={ids.lapelRight} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3d342e" />
            <stop offset="100%" stopColor="#1e1a17" />
          </linearGradient>

          <linearGradient id={ids.shirtGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34302b" />
            <stop offset="100%" stopColor="#1c1916" />
          </linearGradient>

          <linearGradient id={ids.skinLight} x1="88%" y1="22%" x2="14%" y2="88%">
            <stop offset="0%" stopColor="#be845d" />
            <stop offset="45%" stopColor="#8a593c" />
            <stop offset="100%" stopColor="#362015" />
          </linearGradient>

          <linearGradient id={ids.handLight} x1="15%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#c98d64" />
            <stop offset="50%" stopColor="#966041" />
            <stop offset="100%" stopColor="#4e2e1d" />
          </linearGradient>

          <linearGradient id={ids.crownGrad} x1="18%" y1="0%" x2="86%" y2="100%">
            <stop offset="0%" stopColor="#5f5a55" />
            <stop offset="48%" stopColor="#383431" />
            <stop offset="100%" stopColor="#1d1b19" />
          </linearGradient>

          <linearGradient id={ids.brimTop} x1="0%" y1="65%" x2="100%" y2="20%">
            <stop offset="0%" stopColor="#47423e" />
            <stop offset="50%" stopColor="#2f2c29" />
            <stop offset="100%" stopColor="#59534d" />
          </linearGradient>

          <linearGradient id={ids.whiskey} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f7b04f" />
            <stop offset="42%" stopColor="#c75914" />
            <stop offset="100%" stopColor="#5c2007" />
          </linearGradient>

          <linearGradient id={ids.tableWood} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2b190f" />
            <stop offset="32%" stopColor="#180e08" />
            <stop offset="100%" stopColor="#090503" />
          </linearGradient>

          <linearGradient id={ids.smokeA} x1="0%" y1="100%" x2="55%" y2="0%">
            <stop offset="0%" stopColor="#83a1c2" stopOpacity="0.52" />
            <stop offset="55%" stopColor="#9cb7d4" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#bdd1e8" stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id={ids.smokeB} x1="10%" y1="100%" x2="80%" y2="0%">
            <stop offset="0%" stopColor="#6c8aa9" stopOpacity="0.42" />
            <stop offset="65%" stopColor="#8ea8c4" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#b5cae0" stopOpacity="0.04" />
          </linearGradient>

          <pattern id={ids.pinLeft} width="11" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(7)">
            <line x1="2" y1="0" x2="2" y2="40" stroke="#7e756c" strokeWidth="0.95" strokeOpacity="0.22" />
          </pattern>
          <pattern id={ids.pinRight} width="11" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
            <line x1="2" y1="0" x2="2" y2="40" stroke="#7e756c" strokeWidth="0.95" strokeOpacity="0.24" />
          </pattern>

          <pattern id={ids.stubble} width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="0.7" fill="#170e09" opacity="0.52" />
            <circle cx="5.2" cy="4.4" r="0.65" fill="#120b07" opacity="0.46" />
            <circle cx="3.1" cy="6.1" r="0.6" fill="#1c110b" opacity="0.4" />
          </pattern>

          <clipPath id={ids.boxClip}>
            <rect x="74" y="88" width="612" height="842" rx="14" />
          </clipPath>
        </defs>
      </svg>

      {/* 3D Diorama Stage */}
      <div
        className="relative w-full h-full transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${(2 + tiltX).toFixed(2)}deg) rotateY(${(-7 + tiltY).toFixed(2)}deg)`,
        }}
      >
        {/* PLANE 1 (Deepest: z = -65px): Recessed Shadowbox Wall, Bar Shelves & Gold Frame */}
        <svg
          viewBox="0 0 760 1000"
          className="w-full h-full overflow-visible"
          style={{ transform: 'translateZ(-65px)' }}
          aria-hidden="true"
        >
          <rect x="64" y="78" width="632" height="862" rx="18" fill="#0d0908" stroke="#38281c" strokeWidth="2" />
          <g clipPath={`url(#${ids.boxClip})`}>
            <rect x="74" y="88" width="612" height="842" fill={`url(#${ids.bgWall})`} />
            <rect x="74" y="88" width="612" height="842" fill={`url(#${ids.amberGlow})`} />
            <g filter={`url(#${ids.softBokeh})`} opacity="0.86">
              <ellipse cx="116" cy="264" rx="42" ry="22" fill="#f7ca7e" opacity="0.72" />
              <ellipse cx="116" cy="264" rx="82" ry="44" fill="#c97122" opacity="0.3" />
              <rect x="70" y="324" width="175" height="10" fill="#2c1a0e" />
              <rect x="92" y="288" width="16" height="38" rx="3" fill="#b86b24" opacity="0.7" />
              <rect x="118" y="280" width="18" height="46" rx="4" fill="#d99a44" opacity="0.65" />
              <rect x="146" y="294" width="14" height="32" rx="3" fill="#5e7238" opacity="0.6" />
              <rect x="170" y="286" width="16" height="40" rx="3" fill="#c97c2b" opacity="0.65" />

              <rect x="520" y="262" width="175" height="10" fill="#2b190d" />
              <rect x="546" y="220" width="17" height="44" rx="4" fill="#c97c2d" opacity="0.65" />
              <rect x="572" y="228" width="15" height="36" rx="3" fill="#823b16" opacity="0.7" />
              <rect x="596" y="214" width="19" height="50" rx="4" fill="#e0a64b" opacity="0.65" />
              <rect x="624" y="226" width="14" height="38" rx="3" fill="#5d703b" opacity="0.55" />
              <rect x="648" y="220" width="17" height="44" rx="4" fill="#ba6a22" opacity="0.6" />
              <circle cx="590" cy="196" r="16" fill="#f5c97a" opacity="0.45" />
              <circle cx="646" cy="190" r="13" fill="#f0b65c" opacity="0.4" />
              <circle cx="158" cy="230" r="15" fill="#eb9f44" opacity="0.34" />
            </g>
            <path d="M64,504 Q82,442 108,440 Q130,440 138,476 L154,572 L64,572 Z" fill="#17100b" opacity="0.82" filter={`url(#${ids.softBokeh})`} />
            <circle cx="108" cy="414" r="22" fill="#1a120d" opacity="0.82" filter={`url(#${ids.softBokeh})`} />
            <rect x="74" y="88" width="612" height="842" rx="14" fill="none" stroke="#000000" strokeWidth="30" opacity="0.76" />
          </g>
          <rect x="74" y="88" width="612" height="842" rx="14" fill="none" stroke={`url(#${ids.frameGold})`} strokeWidth="3" />
          <rect x="83" y="97" width="594" height="824" rx="10" fill="none" stroke="#e8c67a" strokeOpacity="0.28" strokeWidth="1.2" />
        </svg>

        {/* PLANE 2 (z = 0px): Suit Torso, Shoulders, Shirt, Tie & Notched Lapels */}
        <svg
          viewBox="0 0 760 1000"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ transform: 'translateZ(0px)' }}
          aria-hidden="true"
        >
          <g filter={`url(#${ids.shadowBack})`}>
            <path
              d="M254,352 L144,394 Q98,414 78,496 L28,744 Q18,794 42,844 L76,920 L712,924 L732,762 Q736,626 694,474 Q672,400 614,380 L492,338 L384,440 Z"
              fill={`url(#${ids.suitBase})`}
            />
            <path
              d="M254,352 L144,394 Q98,414 78,496 L28,744 Q18,794 42,844 L76,920 L380,920 L384,440 Z"
              fill={`url(#${ids.pinLeft})`}
            />
            <path
              d="M384,440 L492,338 L614,380 Q672,400 694,474 Q736,626 732,762 L712,924 L380,920 Z"
              fill={`url(#${ids.pinRight})`}
            />
            <path d="M144,394 Q174,458 186,558 L156,742 L76,752 L78,496 Q98,414 144,394 Z" fill="#141210" opacity="0.52" />
            <path d="M614,380 Q590,468 586,608 L624,894 L712,924 L732,762 Q736,626 694,474 Q672,400 614,380 Z" fill="#110f0d" opacity="0.58" />
            <path d="M254,352 L144,394 Q98,414 78,496 Q104,420 148,402 L254,360 Z" fill="#634f3d" opacity="0.55" />
            <path d="M492,338 L614,380 Q672,400 694,474 Q666,408 608,388 L490,348 Z" fill="#82654b" opacity="0.62" />
          </g>

          <g filter={`url(#${ids.shadowMid})`}>
            <polygon points="282,354 484,340 434,786 352,806" fill="#0f0d0c" />
            <path d="M298,350 L466,340 L438,778 L346,796 L314,586 Z" fill={`url(#${ids.shirtGrad})`} />
            <path d="M326,288 L444,284 L448,370 L386,444 L322,370 Z" fill="#4f3526" />
            <path d="M326,288 L444,284 L444,354 Q388,392 324,350 Z" fill="#20140e" opacity="0.74" />
            <path d="M408,334 L440,316 L442,368 L400,418 Z" fill="#7c543c" opacity="0.62" />
            <g filter={`url(#${ids.shadowCrisp})`}>
              <path d="M366,402 L406,400 L398,448 L372,448 Z" fill="#171514" />
              <path d="M372,448 L398,448 L418,718 L385,758 L354,718 Z" fill="#131110" />
              <path d="M388,448 L398,448 L416,718 L385,758 Z" fill="#25221f" opacity="0.52" />
            </g>
            <path d="M320,340 L368,408 L314,458 L294,398 Z" fill="#3a3631" filter={`url(#${ids.shadowCrisp})`} />
            <path d="M446,332 L470,394 L442,452 L402,404 Z" fill="#48413a" filter={`url(#${ids.shadowCrisp})`} />
            <path d="M446,332 L402,404 L407,408 L450,338 Z" fill="#72675b" opacity="0.65" />
          </g>

          <g filter={`url(#${ids.shadowCrisp})`}>
            <path d="M280,346 L228,454 L258,480 L236,512 L344,784 L356,768 L298,450 L294,346 Z" fill={`url(#${ids.lapelLeft})`} />
            <path d="M280,346 L228,454 L258,480 L236,512 L344,784 L356,768 L298,450 L294,346 Z" fill={`url(#${ids.pinLeft})`} opacity="0.85" />
            <path d="M228,454 L258,480 L236,512 L344,784 L340,787 L231,512 L252,480 L224,455 Z" fill="#63574c" opacity="0.55" />

            <path d="M472,334 L528,444 L498,470 L522,502 L416,780 L404,766 L454,446 L460,334 Z" fill={`url(#${ids.lapelRight})`} />
            <path d="M472,334 L528,444 L498,470 L522,502 L416,780 L404,766 L454,446 L460,334 Z" fill={`url(#${ids.pinRight})`} opacity="0.9" />
            <path d="M528,444 L498,470 L522,502 L416,780 L420,783 L527,502 L504,470 L532,445 Z" fill="#8f755d" opacity="0.65" />
          </g>
        </svg>

        {/* PLANE 3 (z = 30px): Sculpted Face, Stubble, Nose & Smirk */}
        <svg
          viewBox="0 0 760 1000"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ transform: 'translateZ(30px)' }}
          aria-hidden="true"
        >
          <g filter={`url(#${ids.shadowMid})`}>
            <path d="M484,200 Q516,194 514,230 Q512,262 484,270 L476,226 Z" fill="#6c4833" />
            <path d="M490,210 Q506,208 504,234 Q502,252 488,258 Z" fill="#281810" opacity="0.78" />
            <path d="M506,204 Q515,222 504,254" fill="none" stroke="#b98360" strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />

            <path
              d="M266,214 L270,278 Q278,332 310,364 L358,396 Q380,404 402,395 L444,366 Q478,336 486,278 L494,202 L382,190 Z"
              fill={`url(#${ids.skinLight})`}
            />
            <path d="M404,244 Q454,250 478,284 Q468,328 438,356 L400,378 L390,304 Z" fill="#ae7550" opacity="0.78" />
            <path d="M430,258 Q466,268 476,294 Q462,320 438,336 Z" fill="#c98e65" opacity="0.54" />
            <path d="M266,214 L350,216 Q338,274 342,318 L318,370 Q280,338 270,278 Z" fill="#27170f" opacity="0.72" filter={`url(#${ids.softShadow})`} />

            <path d="M366,224 Q380,222 390,228 L394,282 Q396,298 380,306 Q364,302 362,286 Z" fill="#996444" />
            <path d="M376,228 Q384,228 388,236 L390,282 Q384,292 374,288 Z" fill="#c78b63" opacity="0.78" />
            <path d="M362,292 Q378,304 394,290 Q388,308 378,310 Q366,308 362,292 Z" fill="#2e1b11" opacity="0.78" />

            <path
              d="M274,286 Q302,318 344,316 L364,312 L396,314 Q444,314 478,284 Q474,334 444,366 L402,395 Q380,404 358,396 L310,364 Q278,334 274,286 Z"
              fill="#25160f"
              opacity="0.54"
            />
            <path
              d="M274,286 Q302,318 344,316 L364,312 L396,314 Q444,314 478,284 Q474,334 444,366 L402,395 Q380,404 358,396 L310,364 Q278,334 274,286 Z"
              fill={`url(#${ids.stubble})`}
            />

            <path d="M346,336 Q378,348 414,330" fill="none" stroke="#1c100a" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M350,337 Q378,346 410,332 Q394,342 362,343 Z" fill="#3b2015" />
            <path d="M362,348 Q382,354 400,344 Q382,358 362,352 Z" fill="#a87050" opacity="0.72" />
            <path d="M416,314 Q425,330 417,344" fill="none" stroke="#29170f" strokeWidth="2.2" strokeLinecap="round" opacity="0.68" />
            <path d="M342,318 Q334,334 342,346" fill="none" stroke="#24140d" strokeWidth="2.2" strokeLinecap="round" opacity="0.62" />

            <path
              d="M260,204 L496,174 L492,226 Q454,232 424,242 Q396,252 382,238 Q356,258 322,262 Q288,266 268,262 Z"
              fill="#0d0806"
              opacity="0.92"
              filter={`url(#${ids.softShadow})`}
            />
            <path d="M402,240 Q432,228 462,234 Q436,246 408,248 Z" fill="#21130c" opacity="0.82" />
            <path d="M410,248 Q438,242 458,246" fill="none" stroke="#8c5a3d" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>

        {/* PLANE 4 (z = 52px): Charcoal Fedora Crown & Grosgrain Band */}
        <svg
          viewBox="0 0 760 1000"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ transform: 'translateZ(52px)' }}
          aria-hidden="true"
        >
          <g filter={`url(#${ids.shadowBack})`}>
            <path
              d="M206,176 L246,60 Q258,34 290,44 Q328,55 362,34 Q404,12 436,32 Q456,44 478,136 Q344,174 206,176 Z"
              fill={`url(#${ids.crownGrad})`}
            />
            <path d="M248,60 Q262,38 292,46 Q326,56 350,42 L340,146 L220,164 Z" fill="#635e59" opacity="0.44" />
            <path d="M312,48 Q350,62 396,38 Q380,68 346,74 Q320,70 312,48 Z" fill="#1e1b19" opacity="0.58" filter={`url(#${ids.softShadow})`} />
            <path d="M254,78 Q274,108 262,146 L232,152 Z" fill="#211e1c" opacity="0.38" filter={`url(#${ids.softShadow})`} />
            <path d="M406,26 Q444,26 462,84 L478,136 L396,150 Z" fill="#201d1b" opacity="0.65" />
            <path d="M204,158 Q340,152 480,122 L486,154 Q344,184 198,188 Z" fill="#151313" />
            <path d="M204,158 Q340,152 480,122" fill="none" stroke="#524c47" strokeWidth="1.8" opacity="0.65" />
            <path d="M428,132 L468,122 L472,152 L430,162 Z" fill="#1f1c1b" filter={`url(#${ids.shadowCrisp})`} />
            <rect x="442" y="128" width="12" height="30" rx="2" transform="rotate(-12 448 143)" fill="#2b2725" />
          </g>
        </svg>

        {/* PLANE 5 (z = 78px): Sweeping Pop-Out Fedora Brim */}
        <svg
          viewBox="0 0 760 1000"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ transform: 'translateZ(78px)' }}
          aria-hidden="true"
        >
          <g filter={`url(#${ids.shadowPop})`}>
            <path
              d="M112,248 Q216,250 342,218 Q480,184 598,116 Q574,150 480,188 Q344,236 190,260 Q140,264 112,248 Z"
              fill="#1e1c1a"
            />
            <path
              d="M112,248 Q140,202 206,176 Q340,174 480,138 Q546,122 598,116 Q544,160 440,194 Q288,244 148,254 Q124,254 112,248 Z"
              fill={`url(#${ids.brimTop})`}
            />
            <path
              d="M112,248 Q150,252 286,228 Q444,196 598,116 Q584,129 446,186 Q290,238 148,250 Z"
              fill="#7f776e"
              opacity="0.72"
            />
          </g>
        </svg>

        {/* PLANE 6 (Closest Pop-Out: z = 98px): Mahogany Table, Arm, Hand, Crystal Whiskey Glass, Cigar & Smoke */}
        <svg
          viewBox="0 0 760 1000"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ transform: 'translateZ(98px)' }}
          aria-hidden="true"
        >
          <g filter={`url(#${ids.shadowPop})`}>
            <path d="M18,906 L742,882 L756,996 L4,996 Z" fill={`url(#${ids.tableWood})`} />
            <ellipse cx="344" cy="952" rx="132" ry="20" fill="#8f4513" opacity="0.34" />
            <line x1="18" y1="906" x2="742" y2="882" stroke="#613c24" strokeWidth="2.5" opacity="0.68" />

            <g filter={`url(#${ids.shadowBack})`}>
              <path
                d="M34,740 Q106,756 176,802 Q196,818 192,866 Q188,904 166,912 L40,910 Q14,832 34,740 Z"
                fill="#1e1b18"
              />
              <path
                d="M34,740 Q106,756 176,802 Q196,818 192,866 Q188,904 166,912 L40,910 Q14,832 34,740 Z"
                fill={`url(#${ids.pinLeft})`}
              />
              <path d="M36,742 Q108,758 176,802 Q172,812 164,812 Q100,770 36,756 Z" fill="#5e4b3a" opacity="0.32" />
              <path d="M164,798 Q186,810 198,828 L194,904 L168,908 Q178,854 164,798 Z" fill="#2e2a25" />
            </g>

            <g filter={`url(#${ids.shadowCrisp})`}>
              <path d="M258,788 L430,788 L414,966 Q344,978 274,966 Z" fill="#2b1910" fillOpacity="0.56" stroke="#dfc7ad" strokeOpacity="0.58" strokeWidth="2" />
              <path d="M268,864 Q344,874 420,864 L412,954 Q344,966 276,954 Z" fill={`url(#${ids.whiskey})`} />
              <polygon points="300,872 344,882 328,926 286,910" fill="#ffd282" opacity="0.42" />
              <polygon points="354,870 402,878 390,922 346,912" fill="#de7624" opacity="0.55" />
              <polygon points="328,894 374,904 358,944 316,936" fill="#ff9e3d" opacity="0.34" />
              <path d="M276,950 Q344,962 412,950 L414,966 Q344,978 274,966 Z" fill="#d4bca2" fillOpacity="0.36" />
              <g stroke="#f7e2c8" strokeOpacity="0.65" strokeWidth="1.25" fill="none">
                <polyline points="280,872 312,952 344,882 376,952 408,872" />
                <polyline points="278,912 312,882 344,956 376,882 410,912" />
                <polyline points="296,876 312,916 344,954 376,916 392,876" strokeOpacity="0.45" />
                <line x1="284" y1="802" x2="286" y2="864" strokeOpacity="0.35" />
                <line x1="344" y1="806" x2="344" y2="868" strokeOpacity="0.25" />
                <line x1="406" y1="800" x2="402" y2="864" strokeOpacity="0.5" />
              </g>
              <ellipse cx="344" cy="788" rx="86" ry="12.5" fill="none" stroke="#f5e3cc" strokeOpacity="0.86" strokeWidth="2.4" />
              <ellipse cx="344" cy="789.5" rx="84" ry="10.5" fill="none" stroke="#d1863a" strokeOpacity="0.45" strokeWidth="1.1" />
            </g>

            <g filter={`url(#${ids.shadowCrisp})`}>
              <path d="M168,818 Q208,796 256,802 Q278,810 278,848 L272,934 Q224,946 168,910 Z" fill={`url(#${ids.handLight})`} />
              <path d="M178,824 Q216,808 254,816 L248,864 L182,876 Z" fill="#d1956c" opacity="0.48" filter={`url(#${ids.softShadow})`} />
              <path d="M214,808 Q250,795 282,809 Q292,818 274,827 Q242,828 212,820 Z" fill="#b57a55" filter={`url(#${ids.shadowCrisp})`} />
              <path d="M244,832 Q290,829 332,843 Q346,850 332,861 Q288,859 240,851 Z" fill="#be825c" filter={`url(#${ids.shadowCrisp})`} />
              <path d="M256,836 Q294,835 324,845" fill="none" stroke="#e0a57c" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
              <ellipse cx="328" cy="851" rx="7" ry="4" transform="rotate(8 328 851)" fill="#d69c77" opacity="0.45" />
              <path d="M238,857 Q290,860 338,879 Q349,888 334,898 Q284,891 232,876 Z" fill="#ad724e" filter={`url(#${ids.shadowCrisp})`} />
              <path d="M254,863 Q298,867 332,881" fill="none" stroke="#d4966e" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <ellipse cx="333" cy="887" rx="6.5" ry="3.8" transform="rotate(10 333 887)" fill="#c98e69" opacity="0.4" />
              <path d="M228,885 Q274,892 314,910 Q325,919 310,928 Q266,920 220,903 Z" fill="#8f593b" filter={`url(#${ids.shadowCrisp})`} />
              <ellipse cx="310" cy="918" rx="5.5" ry="3.3" transform="rotate(12 310 918)" fill="#b37855" opacity="0.35" />
              <path d="M214,912 Q252,920 284,935 Q292,943 278,949 Q242,941 206,926 Z" fill="#693f28" />
            </g>

            <g filter={`url(#${ids.shadowCrisp})`}>
              <ellipse cx="628" cy="954" rx="114" ry="29" fill="#2d2621" stroke="#8f7e6f" strokeOpacity="0.58" strokeWidth="2" />
              <ellipse cx="628" cy="942" rx="90" ry="17" fill="#171310" stroke="#bfa994" strokeOpacity="0.45" strokeWidth="1.5" />
              <line x1="540" y1="944" x2="530" y2="968" stroke="#c7b29c" strokeOpacity="0.45" strokeWidth="2" />
              <line x1="584" y1="956" x2="580" y2="978" stroke="#c7b29c" strokeOpacity="0.4" strokeWidth="2" />
              <line x1="672" y1="956" x2="678" y2="978" stroke="#c7b29c" strokeOpacity="0.4" strokeWidth="2" />
              <line x1="716" y1="944" x2="726" y2="966" stroke="#c7b29c" strokeOpacity="0.4" strokeWidth="2" />
              <path d="M578,910 L734,922 Q744,932 732,942 L576,928 Z" fill="#3b2518" />
              <path d="M578,910 L734,922 L734,928 L578,916 Z" fill="#6b452e" opacity="0.65" />
              <polygon points="694,919 708,920 706,940 692,939" fill="#a67d3d" />
              <ellipse cx="577" cy="919" rx="6" ry="9" fill="#59534f" />
              <ellipse cx="574" cy="919" rx="3.5" ry="6" fill="#ff6b1f" />
              <circle cx="574" cy="919" r="2.8" fill="#ffd269" />
            </g>

            <g filter={`url(#${ids.smokeBlur})`}>
              <path
                d="M575,906 Q558,844 580,788 Q604,732 574,678 Q548,632 582,580 Q610,536 578,494 Q620,532 608,586 Q596,638 618,684 Q636,734 598,796 Q576,846 584,904 Z"
                fill={`url(#${ids.smokeA})`}
              />
              <path
                d="M582,882 Q610,828 584,772 Q554,718 594,666 Q638,616 592,562 Q646,592 630,652 Q616,704 584,762 Q614,820 584,884 Z"
                fill={`url(#${ids.smokeB})`}
              />
              <path
                d="M598,642 Q560,602 592,554 Q626,512 648,546 Q622,554 606,586 Q592,616 610,642 Z"
                fill="#a3bedb"
                opacity="0.32"
              />
            </g>
          </g>

          <rect x="0" y="0" width="760" height="1000" fill="#ffffff" opacity="0.025" filter={`url(#${ids.paperGrain})`} pointerEvents="none" />
        </svg>
      </div>
    </div>
  );
}
