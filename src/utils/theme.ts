export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // If 3-character hex, expand to 6-character
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse r, g, b
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function applyTheme(hexColor: string) {
  if (typeof window === "undefined") return;

  // Save to localStorage
  localStorage.setItem("fasty_theme_color", hexColor);

  const { h, s, l } = hexToHsl(hexColor);

  // Generate color styles
  const primaryVal = `${h} ${s}% ${l}%`;
  const primaryGlowVal = `${h} ${s}% ${Math.min(l + 10, 95)}%`;
  const gradientHero = `linear-gradient(135deg, hsl(${h} ${s}% ${l}%) 0%, hsl(${(h + 15) % 360} ${s}% ${Math.min(l + 5, 95)}%) 50%, hsl(${(h - 20 + 360) % 360} ${Math.max(s - 10, 30)}% ${Math.min(l + 5, 95)}%) 100%)`;

  let styleEl = document.getElementById("fasty-dynamic-theme");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "fasty-dynamic-theme";
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    :root {
      --primary: ${primaryVal} !important;
      --primary-glow: ${primaryGlowVal} !important;
      --ring: ${primaryVal} !important;
      --gradient-hero: ${gradientHero} !important;
      --shadow-soft: 0 4px 20px -8px hsl(${h} ${s}% ${l}% / 0.18) !important;
      --shadow-glow: 0 20px 60px -20px hsl(${h} ${s}% ${l}% / 0.45) !important;
    }
    
    /* Adapt custom components or styles if necessary */
    .bg-gradient-hero {
      background: ${gradientHero} !important;
    }
    
    /* Overwrite specific teal accents in Index2.tsx with dynamic theme if active */
    .bg-[#0d8496] {
      background-color: hsl(${h} ${s}% ${Math.max(l - 5, 10)}%) !important;
    }
    .bg-[#0b7282] {
      background-color: hsl(${h} ${s}% ${Math.max(l - 12, 5)}%) !important;
    }
    .text-[#0d8496] {
      color: hsl(${h} ${s}% ${l}%) !important;
    }
    .border-cyan-800 {
      border-color: hsl(${h} ${s}% ${Math.max(l - 15, 5)}%) !important;
    }
    .border-cyan-700\\/50 {
      border-color: hsl(${h} ${s}% ${Math.max(l - 15, 5)}% / 0.5) !important;
    }
    .border-cyan-400\\/20 {
      border-color: hsl(${h} ${s}% ${Math.min(l + 10, 90)}% / 0.2) !important;
    }
    .text-cyan-50 {
      color: hsl(${h} ${s}% 95%) !important;
    }
    .text-cyan-100 {
      color: hsl(${h} ${s}% 90%) !important;
    }
    .text-cyan-200 {
      color: hsl(${h} ${s}% 85%) !important;
    }
    .text-cyan-200\\/70 {
      color: hsl(${h} ${s}% 85% / 0.7) !important;
    }
    .bg-gradient-to-r.from-teal-50.to-emerald-50 {
      background-image: linear-gradient(to right, hsl(${h} ${s}% 97%), hsl(${(h + 40) % 360} ${s}% 97%)) !important;
    }
    .border-teal-100 {
      border-color: hsl(${h} ${s}% 90%) !important;
    }
    .text-teal-800 {
      color: hsl(${h} ${s}% ${Math.max(l - 25, 20)}%) !important;
    }
    .text-teal-600 {
      color: hsl(${h} ${s}% ${Math.max(l - 10, 30)}%) !important;
    }
  `;
}

export function getThemeColor(): string {
  if (typeof window === "undefined") return "#f97316"; // Original Fasty Orange
  return localStorage.getItem("fasty_theme_color") || "#f97316";
}

export function resetTheme() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fasty_theme_color");
  const styleEl = document.getElementById("fasty-dynamic-theme");
  if (styleEl) {
    styleEl.remove();
  }
}

export function initTheme() {
  if (typeof window === "undefined") return;
  const savedColor = localStorage.getItem("fasty_theme_color");
  if (savedColor) {
    applyTheme(savedColor);
  }
}
