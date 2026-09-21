/** Tiny event bus so any "Log update" button can open the global quick-capture dialog. */
export const CAPTURE_EVENT = "workhub:capture";

export type CaptureDetail = { initiativeId?: string };

export function openCapture(detail: CaptureDetail = {}) {
  window.dispatchEvent(new CustomEvent<CaptureDetail>(CAPTURE_EVENT, { detail }));
}
