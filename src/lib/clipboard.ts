/**
 * Utility to copy text to clipboard across all platforms and environments,
 * including non-secure contexts (HTTP via local network IP) and mobile browsers (iOS Safari, Android).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API if supported and in secure context
  if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed, using fallback:', err);
    }
  }

  // 2. Fallback: document.execCommand('copy') via temporary textarea element
  try {
    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Do NOT set readonly as it prevents iOS Safari from selecting and copying
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.style.fontSize = '16px'; // Prevent auto-zoom in iOS Safari

    document.body.appendChild(textArea);

    // Save current active element
    const previousActive = document.activeElement as HTMLElement | null;

    // Focus & select
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    // iOS Safari specific selection range
    const isIOS = typeof navigator !== 'undefined' && /ipad|iphone|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textArea.setSelectionRange(0, 999999);
    }

    const successful = document.execCommand('copy');
    
    // Cleanup selection & remove element
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    document.body.removeChild(textArea);

    if (previousActive && typeof previousActive.focus === 'function') {
      previousActive.focus();
    }

    return successful;
  } catch (err) {
    console.error('[Clipboard] Fallback execCommand failed:', err);
    return false;
  }
}
