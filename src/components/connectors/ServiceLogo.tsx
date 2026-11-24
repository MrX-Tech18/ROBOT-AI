import type { ConnectorServiceKey } from '../../shared/types';

interface ServiceLogoProps {
  service: ConnectorServiceKey;
  size?: number;
}

export default function ServiceLogo({ service, size = 36 }: ServiceLogoProps) {
  switch (service) {
    case 'gmail':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path
              fill="#EA4335"
              d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
            />
          </svg>
        </div>
      );
    case 'outlook':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <rect x="3" y="5" width="18" height="14" rx="2" fill="#0078D4" />
            <path d="M3 7l9 6 9-6" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
          </svg>
        </div>
      );
    case 'google_calendar':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#1A73E8" />
            <rect x="6" y="9" width="12" height="9" rx="1" fill="#FFFFFF" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              fill="#1A73E8"
            >
              31
            </text>
          </svg>
        </div>
      );
    case 'google_drive':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#0F9D58" d="M8.5 4 2 15.2l3.4 5.8 6.5-11.2z" />
            <path fill="#F4B400" d="M15.5 4h-7l6.5 11.2h7z" />
            <path fill="#4285F4" d="M5.4 21h13.2l3.4-5.8H8.8z" />
          </svg>
        </div>
      );
    case 'slack':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <rect x="9.5" y="3" width="2.5" height="7" rx="1.25" fill="#E01E5A" />
            <rect x="14" y="9.5" width="7" height="2.5" rx="1.25" fill="#2EB67D" />
            <rect x="12" y="14" width="2.5" height="7" rx="1.25" fill="#ECB22E" />
            <rect x="3" y="12" width="7" height="2.5" rx="1.25" fill="#36C5F0" />
          </svg>
        </div>
      );
    case 'telegram':
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <circle cx="12" cy="12" r="9.5" fill="#0088CC" />
            <path
              fill="#FFFFFF"
              d="M16.9 7.8 6.8 11.7c-.7.3-.7.7-.1.9l2.6.8 6-3.8c.3-.2.5-.1.3.1l-4.9 4.4-.2 2.7c.3 0 .4-.1.6-.3l1.4-1.3 2.8 2.1c.5.3.9.1 1-.5l1.8-8.3c.2-.7-.3-1.1-.8-.7z"
            />
          </svg>
        </div>
      );
  }
}
