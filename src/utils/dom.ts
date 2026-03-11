/** Wait for an element matching the selector to appear in the DOM */
export function waitForElement(
  doc: Document,
  selector: string,
  timeoutMs = 8000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = doc.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = doc.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(doc.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(doc.querySelector(selector));
    }, timeoutMs);
  });
}
