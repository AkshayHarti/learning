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
})();
