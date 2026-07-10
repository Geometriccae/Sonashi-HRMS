import { createPortal } from "react-dom";

/**
 * Renders modals into document.body so they sit above the header shell
 * and are not clipped by page scroll containers.
 */
export default function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
