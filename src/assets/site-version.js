(function (root) {
  "use strict";

  const site = Object.freeze({
    version: "2026.09.11",
    released: "11 September 2026"
  });

  root.MastersSite = site;
  if (typeof document !== "undefined") {
    document.querySelectorAll("[data-site-version]").forEach((element) => {
      element.textContent = site.version;
      element.title = `Prepared ${site.released}`;
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
