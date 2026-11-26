// Shared chrome behaviours for generated pages. Mounted apps do not load this.

(() => {
  // Mark the current page in any course rail, so a page reached by direct URL
  // still shows where it sits in its course.
  const here = location.pathname.replace(/\/index\.html$/, "/");
  for (const link of document.querySelectorAll(".rail a[href]")) {
    const target = new URL(link.href, location.href).pathname.replace(/\/index\.html$/, "/");
    if (target === here) link.setAttribute("aria-current", "page");
  }

  // On narrow screens the rail is a <details>; close it after a jump so the
  // lesson text is not pushed off-screen.
  for (const details of document.querySelectorAll("details.rail")) {
    details.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement && window.matchMedia("(max-width: 61.99rem)").matches) {
        details.open = false;
      }
    });
  }

  // Copy buttons on code panels.
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      const panel = button.closest(".code-panel");
      const codeNode = panel?.querySelector("pre code");
      const code = codeNode?.textContent ?? "";
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied";
      } catch {
        // Clipboard writes can be denied (no permission, or an unfocused
        // window). Select the code instead so one keystroke finishes the job
        // rather than telling the reader to do something that did not happen.
        if (codeNode && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(codeNode);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          button.textContent = "Selected — press ⌘C";
        } else {
          button.textContent = "Copy failed";
        }
      }
      setTimeout(() => {
        button.textContent = original;
      }, 2500);
    });
  }

  // Reading progress bar on lesson pages.
  const progress = document.getElementById("reading-progress");
  if (progress) {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
      progress.style.width = `${ratio * 100}%`;
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update, { passive: true });
    update();
  }
})();
