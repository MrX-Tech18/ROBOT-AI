import type { BotId, BotStatus } from '../shared/types';

interface CuteRobotAvatarProps {
  botId?: BotId;
  accentHex?: string;
  status?: BotStatus;
  size?: number;
  className?: string;
  showShadow?: boolean;
}

const BOT_ACCENTS: Record<BotId, { primary: string; light: string; glow: string }> = {
  alex: { primary: '#1D9BF0', light: '#67D4FF', glow: '#38BDF8' },
  emma: { primary: '#8B5CF6', light: '#C4B5FD', glow: '#A78BFA' },
  max: { primary: '#00B8FF', light: '#5CE1FF', glow: '#00D8FF' },
  sophie: { primary: '#EC4899', light: '#F9A8D4', glow: '#F472B6' },
  charlie: { primary: '#F59E0B', light: '#FCD34D', glow: '#FBBF24' },
};

export default function CuteRobotAvatar({
  botId = 'max',
  accentHex,
  status = 'idle',
  size = 64,
  className = '',
  showShadow = true,
}: CuteRobotAvatarProps) {
  const palette = BOT_ACCENTS[botId] ?? BOT_ACCENTS.max;
  const primaryColor = accentHex && botId !== 'max' ? accentHex : palette.primary;
  const glowColor =
    status === 'error'
      ? '#FF4D6D'
      : status === 'completed'
        ? '#22E58A'
        : status === 'waiting'
          ? '#FBBF24'
          : status === 'paused'
            ? '#64748B'
            : palette.glow;

  const animClass =
    status === 'working'
      ? 'animate-bot-working'
      : status === 'thinking'
        ? 'animate-bot-thinking'
        : status === 'completed'
          ? 'animate-bot-completed'
          : status === 'error'
            ? 'animate-bot-error'
            : status === 'waiting'
              ? 'animate-bot-waiting'
              : status === 'paused'
                ? 'opacity-80 translate-y-1'
                : 'animate-bot-idle';

  const outline = '#12185B';
  const bodyShade = '#D7E0F6';
  const visorId = `visor-${botId}-${size}`;
  const chestId = `chest-${botId}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 164"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={visorId} cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor={status === 'error' ? '#2E0A1B' : '#0B2B7E'} />
          <stop offset="65%" stopColor={status === 'error' ? '#190510' : '#061546'} />
          <stop offset="100%" stopColor="#040928" />
        </radialGradient>
        <linearGradient id={chestId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="100%" stopColor={primaryColor} />
        </linearGradient>
      </defs>

      {/* Hover ground shadow */}
      {showShadow && (
        <ellipse
          cx="80"
          cy="154"
          rx="28"
          ry="5.5"
          fill="#0F172A"
          className={status === 'paused' ? 'opacity-20' : 'animate-bot-shadow'}
        />
      )}

      <g className={animClass}>
        {/* Left Arm (down or typing) */}
        <g className={status === 'working' ? 'animate-bot-arm-type' : ''}>
          <path
            d={
              status === 'completed'
                ? 'M45 96 C32 82, 22 68, 28 58 C34 50, 44 60, 52 78 Z'
                : 'M48 92 C35 97, 25 113, 30 123 C36 130, 48 122, 54 107 Z'
            }
            fill="#FFFFFF"
            stroke={outline}
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={
              status === 'completed'
                ? 'M31 66 C34 74, 42 84, 49 90'
                : 'M32 120 C37 123, 45 117, 50 106'
            }
            stroke={bodyShade}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>

        {/* Right Arm (cute waving pose matching attached photo in idle/waiting/completed!) */}
        <g
          className={
            status === 'idle' || status === 'waiting' || status === 'completed'
              ? 'animate-bot-wave'
              : status === 'working'
                ? 'animate-bot-arm-type'
                : ''
          }
        >
          {status === 'working' || status === 'paused' ? (
            <path
              d="M112 92 C125 97, 135 113, 130 123 C124 130, 112 122, 106 107 Z"
              fill="#FFFFFF"
              stroke={outline}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <>
              <path
                d="M108 98 C122 95, 136 82, 133 70 C130 62, 118 68, 109 82 Z"
                fill="#FFFFFF"
                stroke={outline}
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M112 94 C122 91, 130 82, 130 75"
                stroke={bodyShade}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </>
          )}
        </g>

        {/* Hovering Pod Body */}
        <path
          d="M49 91 C49 124, 64 142, 80 142 C96 142, 111 124, 111 91 Z"
          fill="#FFFFFF"
          stroke={outline}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        {/* Lower pod shading */}
        <path
          d="M54 106 C58 128, 70 137, 80 137 C90 137, 102 128, 106 106 C99 122, 90 129, 80 129 C70 129, 61 122, 54 106 Z"
          fill={bodyShade}
        />
        {/* Side torso seam lines */}
        <path
          d="M51 102 L61 105 M109 102 L99 105"
          stroke={outline}
          strokeWidth="2.8"
          strokeLinecap="round"
        />

        {/* Chest Shield Emblem (matches attached robot photo + unique role emblem) */}
        <path
          d="M62 96 C62 93, 98 93, 98 96 C98 111, 90 121, 80 121 C70 121, 62 111, 62 96 Z"
          fill={`url(#${chestId})`}
          stroke={outline}
          strokeWidth="3.8"
          strokeLinejoin="round"
        />
        <path
          d="M68 98 C72 96.5, 88 96.5, 92 98"
          stroke="#FFFFFF"
          strokeOpacity="0.6"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {botId === 'alex' && (
          <path
            d="M73 108 L80 102 L87 108"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        )}
        {botId === 'emma' && (
          <path
            d="M80 112 C75 108, 72 104, 75 102 C77 101, 79 102, 80 104 C81 102, 83 101, 85 102 C88 104, 85 108, 80 112 Z"
            fill="#FFFFFF"
            opacity="0.88"
          />
        )}
        {botId === 'max' && (
          <circle cx="80" cy="107" r="4.5" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.9" />
        )}
        {botId === 'sophie' && (
          <path
            d="M80 103 V107.5 L83.5 109.5"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        )}
        {botId === 'charlie' && (
          <path
            d="M81 101 L76 107.5 H80.5 L79 113 L84 106.5 H79.5 Z"
            fill="#FFFFFF"
            opacity="0.9"
          />
        )}

        {/* Top Head Cap */}
        <path
          d="M66 25 C67 17, 93 17, 94 25 Z"
          fill="#FFFFFF"
          stroke={outline}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Personality Headgear Accents */}
        {botId === 'alex' && (
          <path
            d="M74 19 L80 12 L86 19 Z"
            fill={primaryColor}
            stroke={outline}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        )}
        {botId === 'emma' && (
          <g>
            <circle cx="105" cy="24" r="5" fill={primaryColor} stroke={outline} strokeWidth="2.4" />
            <circle cx="114" cy="28" r="4.5" fill={palette.light} stroke={outline} strokeWidth="2.4" />
          </g>
        )}
        {botId === 'max' && (
          <g>
            <line x1="80" y1="18" x2="80" y2="9" stroke={outline} strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="80" cy="7.5" r="4" fill={palette.glow} stroke={outline} strokeWidth="2.4" />
          </g>
        )}
        {botId === 'sophie' && (
          <g>
            <circle cx="52" cy="27" r="4.5" fill={palette.light} stroke={outline} strokeWidth="2.2" />
            <circle cx="56" cy="21" r="4.5" fill={primaryColor} stroke={outline} strokeWidth="2.2" />
            <circle cx="55" cy="25" r="2.2" fill="#FDE047" />
          </g>
        )}
        {botId === 'charlie' && (
          <g transform="rotate(-12 78 21)">
            <ellipse cx="78" cy="18" rx="18" ry="6.5" fill={primaryColor} stroke={outline} strokeWidth="3" />
            <line x1="78" y1="12" x2="80" y2="8" stroke={outline} strokeWidth="2.8" strokeLinecap="round" />
          </g>
        )}

        {/* Left & Right Ear Fins (pointed glowing accent fins) */}
        <path
          d={
            botId === 'max'
              ? 'M32 55 L33 21 C33.5 17, 39 21, 41 34 L41 55 Z'
              : 'M32 55 L34 28 C34.5 24, 39 27, 41 36 L41 55 Z'
          }
          fill={primaryColor}
          stroke={outline}
          strokeWidth="3.8"
          strokeLinejoin="round"
        />
        <path
          d={
            botId === 'max'
              ? 'M128 55 L127 21 C126.5 17, 121 21, 119 34 L119 55 Z'
              : 'M128 55 L126 28 C125.5 24, 121 27, 119 36 L119 55 Z'
          }
          fill={primaryColor}
          stroke={outline}
          strokeWidth="3.8"
          strokeLinejoin="round"
        />

        {/* Left & Right Ear Pods */}
        <rect
          x="26"
          y="46"
          width="15"
          height="34"
          rx="7.5"
          fill="#FFFFFF"
          stroke={outline}
          strokeWidth="4"
        />
        <rect x="29" y="66" width="9" height="10" rx="4.5" fill={bodyShade} />

        <rect
          x="119"
          y="46"
          width="15"
          height="34"
          rx="7.5"
          fill="#FFFFFF"
          stroke={outline}
          strokeWidth="4"
        />
        <rect x="122" y="66" width="9" height="10" rx="4.5" fill={bodyShade} />

        {/* Alex Commander Headset Mic */}
        {botId === 'alex' && (
          <g>
            <path d="M29 73 C28 84, 38 89, 52 86" stroke={outline} strokeWidth="3" strokeLinecap="round" />
            <circle cx="53" cy="86" r="3" fill={primaryColor} stroke={outline} strokeWidth="1.8" />
          </g>
        )}

        {/* Main Rounded Head */}
        <rect
          x="35"
          y="24"
          width="90"
          height="70"
          rx="35"
          fill="#FFFFFF"
          stroke={outline}
          strokeWidth="4.4"
        />
        {/* Subtle chin highlight/shade */}
        <path
          d="M44 76 C54 88, 106 88, 116 76 C106 91, 54 91, 44 76 Z"
          fill={bodyShade}
        />

        {/* Visor Outer Trim & Inner Deep Navy Screen */}
        <rect
          x="44"
          y="36"
          width="72"
          height="49"
          rx="24.5"
          fill={bodyShade}
          stroke={outline}
          strokeWidth="3.6"
        />
        <rect
          x="48"
          y="40"
          width="64"
          height="41"
          rx="20.5"
          fill={`url(#${visorId})`}
          stroke={outline}
          strokeWidth="2.8"
        />

        {/* Sophie Rosy Cheek Glow */}
        {botId === 'sophie' && status !== 'error' && status !== 'paused' && (
          <g fill="#F472B6" opacity="0.45">
            <ellipse cx="57" cy="69" rx="4.5" ry="2.5" />
            <ellipse cx="103" cy="69" rx="4.5" ry="2.5" />
          </g>
        )}

        {/* Visor Eyes / Facial Expression per Live Bot State & Personality */}
        {status === 'error' ? (
          <g stroke={glowColor} strokeWidth="4.5" strokeLinecap="round">
            <path d="M58 55 L68 65 M68 55 L58 65" />
            <path d="M92 55 L102 65 M102 55 L92 65" />
          </g>
        ) : status === 'paused' ? (
          <g stroke={glowColor} strokeWidth="4.2" strokeLinecap="round">
            <line x1="57" y1="60" x2="69" y2="60" />
            <line x1="91" y1="60" x2="103" y2="60" />
          </g>
        ) : status === 'working' ? (
          <g fill={glowColor}>
            <rect x="57" y="53" width="12" height="14" rx="6" />
            <rect x="91" y="53" width="12" height="14" rx="6" />
            <circle cx="61" cy="57" r="2.2" fill="#FFFFFF" opacity="0.85" />
            <circle cx="95" cy="57" r="2.2" fill="#FFFFFF" opacity="0.85" />
          </g>
        ) : status === 'thinking' ? (
          <g>
            <path
              d="M57 62 C58 55, 68 55, 69 62"
              stroke={glowColor}
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            <circle cx="97" cy="59" r="5.5" fill={glowColor} />
            <circle cx="95.5" cy="57" r="1.8" fill="#FFFFFF" opacity="0.85" />
          </g>
        ) : botId === 'max' ? (
          /* Curious Fact-Hunter: happy left eye + glowing cyan optical scanner lens */
          <g>
            <path d="M56 62 C58 54, 69 54, 71 62" stroke={glowColor} strokeWidth="4.8" strokeLinecap="round" fill="none" />
            <circle cx="96.5" cy="59" r="7.5" stroke={glowColor} strokeWidth="3.2" fill="none" />
            <circle cx="96.5" cy="59" r="2.8" fill="#FFFFFF" />
          </g>
        ) : botId === 'charlie' ? (
          /* Playful Storyteller: energetic wink + starry sparkle eye + cheerful grin */
          <g>
            <path d="M56 61 C58 53, 69 53, 71 61" stroke={glowColor} strokeWidth="4.8" strokeLinecap="round" fill="none" />
            <path d="M97 51 L99 57 L105 59 L99 61 L97 67 L95 61 L89 59 L95 57 Z" fill={glowColor} />
            <path d="M74 69 Q80 73 86 69" stroke={glowColor} strokeWidth="2.8" strokeLinecap="round" fill="none" />
          </g>
        ) : botId === 'emma' ? (
          /* Diplomatic Gatekeeper: warm arched eyes with cute lash flare */
          <g stroke={glowColor} strokeWidth="4.8" strokeLinecap="round" fill="none">
            <path d="M56 62 C58 54, 69 54, 71 62" />
            <path d="M55 57 L52 54" strokeWidth="3.2" />
            <path d="M89 62 C91 54, 102 54, 104 62" />
            <path d="M105 57 L108 54" strokeWidth="3.2" />
          </g>
        ) : botId === 'alex' ? (
          /* Decisive Strategist: confident happy eyes + composed slight smile */
          <g stroke={glowColor} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M56 61 C58 53, 69 53, 71 61" />
            <path d="M89 61 C91 53, 102 53, 104 61" />
            <path d="M75 69 Q80 71.5 85 69" strokeWidth="2.6" opacity="0.85" />
          </g>
        ) : (
          /* Sophie Zen Timekeeper: serene happy eyes */
          <g stroke={glowColor} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M56 62 C58 54, 69 54, 71 62" />
            <path d="M89 62 C91 54, 102 54, 104 62" />
          </g>
        )}

        {/* Thinking thought dots above head */}
        {status === 'thinking' && (
          <g fill={glowColor}>
            <circle cx="128" cy="24" r="3" opacity="0.7" />
            <circle cx="137" cy="15" r="4.5" opacity="0.85" />
            <circle cx="148" cy="7" r="6" />
          </g>
        )}

        {/* Completed sparkle star */}
        {status === 'completed' && (
          <path
            d="M138 14 L141 21 L148 24 L141 27 L138 34 L135 27 L128 24 L135 21 Z"
            fill="#22E58A"
            stroke={outline}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {/* Waiting / Alert mini badge */}
        {status === 'error' && (
          <g>
            <circle cx="136" cy="22" r="10" fill="#EF4444" stroke={outline} strokeWidth="2.5" />
            <path d="M136 17 V23" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="136" cy="26.8" r="1.4" fill="#FFFFFF" />
          </g>
        )}
      </g>
    </svg>
  );
}
