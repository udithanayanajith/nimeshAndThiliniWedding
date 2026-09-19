(function () {
  var TITLE_OPTIONS = [
    "MR",
    "MRS",
    "MS",
    "MISS",
    "MASTER",
    "DR",
    "REV",
    "VEN",
    "MR & MRS",
    "MR & MRS & FAMILY",
    "FAMILY",
  ];

  function sanitizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTitle(value) {
    return sanitizeText(value)
      .replace(/\s*\.\s*/g, "")
      .toUpperCase();
  }

  function toTitleCase(value) {
    return sanitizeText(value).replace(
      /\b([A-Za-z])([A-Za-z]*)/g,
      function (_, first, rest) {
        return first.toUpperCase() + rest.toLowerCase();
      },
    );
  }

  function formatGuestName(title, name) {
    var normalizedTitle = normalizeTitle(title);
    var normalizedName = toTitleCase(name);
    var displayTitle = sanitizeText(title);
    var sanitizedName = sanitizeText(name);

    if (!sanitizedName) {
      return "";
    }

    if (normalizedTitle === "FAMILY") {
      return "Family of " + sanitizedName;
    }

    if (normalizedTitle === "MR & MRS & FAMILY") {
      return "MR & MRS . " + normalizedName + " & FAMILY";
    }

    if (TITLE_OPTIONS.indexOf(normalizedTitle) === -1) {
      return normalizedName;
    }

    return displayTitle + " " + normalizedName;
  }

  function safeFilenamePart(value) {
    return sanitizeText(value)
      .replace(/&/g, " AND ")
      .replace(/[^A-Za-z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function generateSafeFilename(type, title, name, extension) {
    var typePart = safeFilenamePart(type || "invitation").toLowerCase();
    var titlePart = safeFilenamePart(title || "");
    var namePart = safeFilenamePart(name || "");
    var ext = (extension || "pdf").replace(/^\./, "");
    var parts = [typePart];

    if (titlePart) {
      parts.push(titlePart);
    }

    if (namePart) {
      parts.push(namePart);
    }

    return parts.join("_") + "." + ext;
  }

  function downloadDataUrl(dataUrl, filename) {
    var link = document.createElement("a");

    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function updatePreviewText(config) {
    var formattedName = formatGuestName(
      config.titleInput.value,
      config.nameInput.value,
    );
    config.nameOutput.textContent = formattedName;

    if (config.tableOutput && config.tableInput) {
      config.tableOutput.textContent = sanitizeText(config.tableInput.value);
    }
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");

      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Failed to load script: " + url));
      };

      document.head.appendChild(script);
    });
  }

  function getJsPdf() {
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      return Promise.resolve(window.jspdf.jsPDF);
    }

    return loadScript(
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
    ).then(function () {
      if (!window.jspdf || typeof window.jspdf.jsPDF !== "function") {
        throw new Error("jsPDF did not initialize correctly.");
      }

      return window.jspdf.jsPDF;
    });
  }

  function getHtml2Canvas() {
    if (typeof window.html2canvas === "function") {
      return Promise.resolve(window.html2canvas);
    }

    return loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    ).then(function () {
      if (typeof window.html2canvas !== "function") {
        throw new Error("html2canvas did not initialize correctly.");
      }

      return window.html2canvas;
    });
  }

  function createExportPreview(previewRoot) {
    var exportRoot = previewRoot.cloneNode(true);

    exportRoot.classList.add("invitation-preview--export");
    exportRoot.setAttribute("aria-hidden", "true");
    exportRoot.style.pointerEvents = "none";
    exportRoot.style.position = "absolute";
    exportRoot.style.left = "0";
    exportRoot.style.top = "0";
    exportRoot.style.width = "1240px";
    exportRoot.style.height = "1748px";
    exportRoot.style.maxWidth = "none";
    exportRoot.style.minWidth = "1240px";
    exportRoot.style.aspectRatio = "1240 / 1748";

    document.body.appendChild(exportRoot);
    return exportRoot;
  }

  function createMobileExportPreview(previewRoot) {
    /*
     * On mobile, do NOT render a 1240px element outside the viewport.
     * That can cause html2canvas to capture only a portion of the card.
     *
     * Instead, clone the actual visible preview width and render that full
     * card. We then increase html2canvas's scale so the downloaded PNG still
     * has enough pixels for A4 printing.
     */
    var exportRoot = previewRoot.cloneNode(true);
    var rect = previewRoot.getBoundingClientRect();
    var captureWidth = Math.max(1, Math.round(rect.width));
    var captureHeight = Math.round(captureWidth * (1748 / 1240));

    exportRoot.classList.remove("invitation-preview--export");
    exportRoot.classList.add("invitation-preview--mobile-export");
    exportRoot.setAttribute("aria-hidden", "true");

    exportRoot.style.pointerEvents = "none";
    exportRoot.style.position = "absolute";
    exportRoot.style.left = "0";
    exportRoot.style.top = "0";
    exportRoot.style.width = captureWidth + "px";
    exportRoot.style.height = captureHeight + "px";
    exportRoot.style.maxWidth = "none";
    exportRoot.style.minWidth = captureWidth + "px";
    exportRoot.style.borderRadius = "0";
    exportRoot.style.boxShadow = "none";
    exportRoot.style.visibility = "hidden";

    document.body.appendChild(exportRoot);

    return {
      root: exportRoot,
      width: captureWidth,
      height: captureHeight,
    };
  }

  async function buildInvitationCanvas(config) {
    var html2canvas;
    var exportRoot;
    var canvas;
    var isMobile = window.matchMedia("(max-width: 720px)").matches;

    await document.fonts.ready;
    html2canvas = await getHtml2Canvas();

    if (isMobile) {
      var mobileExport = createMobileExportPreview(config.previewRoot);
      exportRoot = mobileExport.root;

      try {
        /*
         * Target roughly 2160px wide on the final mobile PNG. This gives a
         * practical high-resolution image without creating an unnecessarily
         * huge canvas on small phones.
         */
        var targetPixels = 2160;
        var mobileScale = Math.max(
          2,
          Math.min(6, targetPixels / mobileExport.width),
        );

        canvas = await html2canvas(exportRoot, {
          backgroundColor: "#ffffff",
          useCORS: true,
          scale: mobileScale,
          width: mobileExport.width,
          height: mobileExport.height,
          windowWidth: mobileExport.width,
          windowHeight: mobileExport.height,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          logging: false,
          imageTimeout: 0,
          removeContainer: true,
          onclone: function (clonedDocument) {
            var style = clonedDocument.createElement("style");

            style.textContent = `
              html, body {
                margin: 0 !important;
                padding: 0 !important;
              }

              .invitation-preview--mobile-export {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: ${mobileExport.width}px !important;
                min-width: ${mobileExport.width}px !important;
                max-width: none !important;
                height: ${mobileExport.height}px !important;
                min-height: ${mobileExport.height}px !important;
                max-height: ${mobileExport.height}px !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                transform: none !important;
                visibility: visible !important;
                opacity: 1 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }

              .invitation-preview--mobile-export > img {
                display: block !important;
                width: ${mobileExport.width}px !important;
                min-width: ${mobileExport.width}px !important;
                max-width: none !important;
                height: ${mobileExport.height}px !important;
                min-height: ${mobileExport.height}px !important;
                max-height: ${mobileExport.height}px !important;
                object-fit: cover !important;
              }

              .invitation-preview--mobile-export .guest-overlay__text {
                white-space: nowrap !important;
                text-align: center !important;
              }
            `;

            clonedDocument.head.appendChild(style);
          },
        });
      } finally {
        exportRoot.remove();
      }

      return canvas;
    }

    /*
     * Desktop path stays on the existing 1240 x 1748 export model so the
     * already-correct desktop Wedding/Homecoming exports remain unchanged.
     */
    exportRoot = createExportPreview(config.previewRoot);

    try {
      canvas = await html2canvas(exportRoot, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: 2,
        width: 1240,
        height: 1748,
        windowWidth: 1240,
        windowHeight: 1748,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
        onclone: function (clonedDocument) {
          var style = clonedDocument.createElement("style");

          style.textContent = `
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 1240px !important;
              min-width: 1240px !important;
              background: #ffffff !important;
            }

            .invitation-preview--export {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 1240px !important;
              min-width: 1240px !important;
              max-width: none !important;
              height: 1748px !important;
              min-height: 1748px !important;
              max-height: 1748px !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              transform: none !important;
            }

            .invitation-preview--export > img {
              display: block !important;
              width: 1240px !important;
              min-width: 1240px !important;
              max-width: none !important;
              height: 1748px !important;
              min-height: 1748px !important;
              max-height: 1748px !important;
              object-fit: cover !important;
            }

            .invitation-preview--export .guest-overlay__text {
              white-space: nowrap !important;
              text-align: center !important;
            }
          `;

          clonedDocument.head.appendChild(style);
        },
      });
    } finally {
      exportRoot.remove();
    }

    return canvas;
  }

  async function downloadPDF(config) {
    var guestName = sanitizeText(config.nameInput.value);
    var JsPdf;
    var canvas;

    if (!guestName) {
      window.alert("Please enter guest name.");
      return;
    }

    updatePreviewText(config);

    JsPdf = await getJsPdf();
    canvas = await buildInvitationCanvas(config);

    var imageData = canvas.toDataURL("image/png");
    var pdf = new JsPdf({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    var pageWidth = pdf.internal.pageSize.getWidth();
    var pageHeight = pdf.internal.pageSize.getHeight();
    var canvasAspect = canvas.width / canvas.height;

    // Use full page width
    var pdfWidth = pageWidth;
    var pdfHeight = pdfWidth / canvasAspect;

    // If height exceeds page, scale down
    if (pdfHeight > pageHeight) {
      pdfHeight = pageHeight;
      pdfWidth = pdfHeight * canvasAspect;
    }

    // Center on page (minimal margins for precise printing)
    var x = (pageWidth - pdfWidth) / 2;
    var y = (pageHeight - pdfHeight) / 2;

    pdf.addImage(
      imageData,
      "PNG",
      x,
      y,
      pdfWidth,
      pdfHeight,
      undefined,
      "FAST",
    );
    // Download the exact same invitation as a PNG image first, then the PDF.
    // Spacing the two triggers on separate ticks keeps browsers from
    // suppressing the second download when they fire back-to-back.
    downloadDataUrl(
      imageData,
      generateSafeFilename(
        config.previewRoot.dataset.filenamePrefix,
        config.titleInput.value,
        guestName,
        "png",
      ),
    );

    window.setTimeout(function () {
      pdf.save(
        generateSafeFilename(
          config.previewRoot.dataset.filenamePrefix,
          config.titleInput.value,
          guestName,
          "pdf",
        ),
      );
    }, 150);
  }

  async function downloadPNG(config) {
    var guestName = sanitizeText(config.nameInput.value);
    var canvas;

    if (!guestName) {
      window.alert("Please enter guest name.");
      return;
    }

    updatePreviewText(config);
    canvas = await buildInvitationCanvas(config);

    downloadDataUrl(
      canvas.toDataURL("image/png"),
      generateSafeFilename(
        config.previewRoot.dataset.filenamePrefix,
        config.titleInput.value,
        guestName,
        "png",
      ),
    );
  }

  function initInvitationPage() {
    var previewRoot = document.querySelector("[data-preview-root]");
    var form = document.querySelector("[data-invitation-form]");

    if (!previewRoot || !form) {
      return;
    }

    var config = {
      previewRoot: previewRoot,
      titleInput: form.querySelector('[data-field="title"]'),
      nameInput: form.querySelector('[data-field="name"]'),
      tableInput: form.querySelector('[data-field="table"]'),
      nameOutput: previewRoot.querySelector("[data-preview-name]"),
      tableOutput: previewRoot.querySelector("[data-preview-table]"),
      downloadButton: document.querySelector("[data-download-pdf]"),
      downloadPngButton: document.querySelector("[data-download-png]"),
    };

    var syncPreview = function () {
      updatePreviewText(config);
    };

    config.titleInput.addEventListener("change", syncPreview);
    config.nameInput.addEventListener("input", syncPreview);

    if (config.tableInput) {
      config.tableInput.addEventListener("input", syncPreview);
    }

    config.downloadButton.addEventListener("click", function () {
      downloadPDF(config).catch(function (error) {
        console.error("PDF generation failed:", error);
        window.alert("Unable to generate PDF. Please try again.");
      });
    });

    if (config.downloadPngButton) {
      config.downloadPngButton.addEventListener("click", function () {
        downloadPNG(config).catch(function (error) {
          console.error("PNG generation failed:", error);
          window.alert("Unable to generate PNG. Please try again.");
        });
      });
    }

    syncPreview();
  }

  window.formatGuestName = formatGuestName;
  window.generateSafeFilename = generateSafeFilename;
  window.downloadDataUrl = downloadDataUrl;
  window.updateInvitationPreview = updatePreviewText;
  window.downloadInvitationPDF = downloadPDF;

  document.addEventListener("DOMContentLoaded", initInvitationPage);
})();
