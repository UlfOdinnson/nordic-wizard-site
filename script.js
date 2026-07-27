
const menuToggle = document.getElementById("menu-toggle");
const navMenu = document.getElementById("nav-menu");

if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = navMenu.contains(event.target);
    const clickedToggle = menuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
      navMenu.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function disableImageActions() {
  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("img")) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", (event) => {
    if (event.target.closest("img")) {
      event.preventDefault();
    }
  });
}

disableImageActions();

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function normalizePath(path) {
  try {
    return new URL(path, window.location.href).pathname;
  } catch (error) {
    return path;
  }
}

function chooseFeaturedItems(items, count) {
  const storageKey = "nw_recent_featured_images";
  let recent = [];

  try {
    recent = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
  } catch (error) {
    recent = [];
  }

  const shuffled = shuffle(items);
  const fresh = shuffled.filter((item) => !recent.includes(item.id));
  const selected = [...fresh.slice(0, count)];

  if (selected.length < count) {
    const backup = shuffled.filter((item) => !selected.some((picked) => picked.id === item.id));
    selected.push(...backup.slice(0, count - selected.length));
  }

  const updatedRecent = [...selected.map((item) => item.id), ...recent]
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, Math.max(count * 4, 12));

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(updatedRecent));
  } catch (error) {
    // Ignore storage failures.
  }

  return selected;
}

async function loadFeaturedWork() {
  const featuredGallery = document.getElementById("featured-work-gallery");
  if (!featuredGallery) return;

  const fallbackItems = [
    {
      id: "images/2026/2026FirstBatch-1.jpg",
      imageSrc: "images/2026/2026FirstBatch-1.jpg",
      linkHref: "library/2026.html",
      label: "2026"
    },
    {
      id: "images/2026/2026FirstBatch-5.jpg",
      imageSrc: "images/2026/2026FirstBatch-5.jpg",
      linkHref: "library/2026.html",
      label: "2026"
    },
    {
      id: "images/2026/2026FirstBatch-12.jpg",
      imageSrc: "images/2026/2026FirstBatch-12.jpg",
      linkHref: "library/2026.html",
      label: "2026"
    }
  ];

  const render = (items) => {
    featuredGallery.innerHTML = "";
    items.forEach((item, index) => {
      const link = document.createElement("a");
      link.href = item.linkHref;
      link.className = "featured-link";

      const img = document.createElement("img");
      img.src = item.imageSrc;
      img.alt = item.alt || `Featured leatherwork ${index + 1}`;

      const meta = document.createElement("div");
      meta.className = "featured-meta";
      meta.textContent = item.label;

      link.appendChild(img);
      link.appendChild(meta);
      featuredGallery.appendChild(link);
    });
  };

  try {
    const libraryResponse = await fetch("library.html", { cache: "no-store" });
    if (!libraryResponse.ok) throw new Error("Could not read library page");

    const libraryText = await libraryResponse.text();
    const parser = new DOMParser();
    const libraryDoc = parser.parseFromString(libraryText, "text/html");
    const yearLinks = Array.from(libraryDoc.querySelectorAll(".year-card[href]"))
      .map((link) => link.getAttribute("href"))
      .filter(Boolean);

    const collectedItems = [];

    for (const pageHref of yearLinks) {
      const pageResponse = await fetch(pageHref, { cache: "no-store" });
      if (!pageResponse.ok) continue;

      const pageText = await pageResponse.text();
      const pageDoc = parser.parseFromString(pageText, "text/html");
      const yearMatch = pageHref.match(/(\d{4})\.html$/);
      const yearLabel = yearMatch ? yearMatch[1] : (pageDoc.querySelector("h1")?.textContent?.match(/\d{4}/)?.[0] || "Library");
      const pageDir = pageHref.includes("/") ? pageHref.slice(0, pageHref.lastIndexOf("/") + 1) : "";

      const galleryImages = Array.from(pageDoc.querySelectorAll(".gallery img[src]"));
      galleryImages.forEach((image, imageIndex) => {
        const src = image.getAttribute("src");
        if (!src) return;
        const resolvedSrc = new URL(src, `${window.location.href.replace(/[^/]*$/, "")}${pageDir}`).href;
        collectedItems.push({
          id: normalizePath(resolvedSrc),
          imageSrc: resolvedSrc,
          linkHref: pageHref,
          alt: image.getAttribute("alt") || `${yearLabel} image ${imageIndex + 1}`,
          label: yearLabel
        });
      });

      if (!galleryImages.length) {
        const configMatch = pageText.match(/window\.NW_GALLERY_CONFIG\s*=\s*\{\s*year:\s*"(\d{4})",\s*folder:\s*"([^"]+)"\s*\}/);
        if (configMatch) {
          const [, configYear, configFolder] = configMatch;
          const batchNames = [
            "FirstBatch", "SecondBatch", "ThirdBatch", "FourthBatch", "FifthBatch",
            "SixthBatch", "SeventhBatch", "EighthBatch", "NinthBatch", "TenthBatch"
          ];

          for (const batchName of batchNames) {
            const firstCandidate = `${pageDir}../images/${configFolder}/${configYear}${batchName}-1.jpg`;
            try {
              const firstResponse = await fetch(firstCandidate, { method: "HEAD", cache: "no-store" });
              if (!firstResponse.ok) break;
            } catch (error) {
              break;
            }

            let imageIndex = 1;
            while (true) {
              const candidate = `${pageDir}../images/${configFolder}/${configYear}${batchName}-${imageIndex}.jpg`;
              try {
                const imageResponse = await fetch(candidate, { method: "HEAD", cache: "no-store" });
                if (!imageResponse.ok) break;
              } catch (error) {
                break;
              }

              const resolvedSrc = new URL(candidate, window.location.href.replace(/[^/]*$/, "")).href;
              collectedItems.push({
                id: normalizePath(resolvedSrc),
                imageSrc: resolvedSrc,
                linkHref: pageHref,
                alt: `${yearLabel} image ${imageIndex}`,
                label: yearLabel
              });
              imageIndex += 1;
            }
          }
        }
      }
    }

    const itemsToRender = collectedItems.length >= 3 ? chooseFeaturedItems(collectedItems, 3) : chooseFeaturedItems(fallbackItems, 3);
    render(itemsToRender);
  } catch (error) {
    render(chooseFeaturedItems(fallbackItems, 3));
  }
}

async function buildLibraryGallery() {
  const gallery = document.getElementById("gallery");
  if (!gallery || !window.NW_GALLERY_CONFIG) return;

  let lightbox = document.getElementById("lightbox");
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "lightbox";
    lightbox.className = "lightbox hidden";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Image viewer");
    lightbox.innerHTML = `
      <button class="lightbox-close" id="close-lightbox" type="button" aria-label="Close image viewer">×</button>
      <button class="lightbox-nav" id="prev-lightbox" type="button" aria-label="Previous image">‹</button>
      <img id="lightbox-image" src="" alt="" />
      <button class="lightbox-nav" id="next-lightbox" type="button" aria-label="Next image">›</button>
    `;
    document.body.appendChild(lightbox);
  }

  const lightboxImage = document.getElementById("lightbox-image");
  const closeLightbox = document.getElementById("close-lightbox");
  const prevLightbox = document.getElementById("prev-lightbox");
  const nextLightbox = document.getElementById("next-lightbox");

  const ORDINAL_BATCHES = [
    "FirstBatch", "SecondBatch", "ThirdBatch", "FourthBatch", "FifthBatch",
    "SixthBatch", "SeventhBatch", "EighthBatch", "NinthBatch", "TenthBatch"
  ];

  async function fileExists(url) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async function findLastImageIndex(prefix) {
    if (!(await fileExists(`${prefix}-1.jpg`))) return 0;

    let confirmed = 1;
    let missing = 2;

    while (await fileExists(`${prefix}-${missing}.jpg`)) {
      confirmed = missing;
      missing *= 2;
    }

    while (confirmed + 1 < missing) {
      const candidate = Math.floor((confirmed + missing) / 2);

      if (await fileExists(`${prefix}-${candidate}.jpg`)) {
        confirmed = candidate;
      } else {
        missing = candidate;
      }
    }

    return confirmed;
  }

  async function detectImages(config, rootPrefix = "../images") {
    const imageFiles = [];
    const year = config.year;
    const folder = config.folder;

    for (const batchName of ORDINAL_BATCHES) {
      const prefix = `${rootPrefix}/${folder}/${year}${batchName}`;
      const lastImageIndex = await findLastImageIndex(prefix);

      if (!lastImageIndex) break;

      for (let index = 1; index <= lastImageIndex; index += 1) {
        imageFiles.push(`${prefix}-${index}.jpg`);
      }
    }

    return imageFiles;
  }

  const imageFiles = await detectImages(window.NW_GALLERY_CONFIG);

  if (!imageFiles.length) {
    gallery.innerHTML = `<div class="empty-state">No gallery images found for this year yet.</div>`;
    return;
  }

  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    lightboxImage.src = imageFiles[currentIndex];
    lightboxImage.alt = `Leatherwork image ${currentIndex + 1}`;
    lightbox.classList.remove("hidden");
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % imageFiles.length;
    lightboxImage.src = imageFiles[currentIndex];
    lightboxImage.alt = `Leatherwork image ${currentIndex + 1}`;
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + imageFiles.length) % imageFiles.length;
    lightboxImage.src = imageFiles[currentIndex];
    lightboxImage.alt = `Leatherwork image ${currentIndex + 1}`;
  }

  gallery.innerHTML = "";

  imageFiles.forEach((file, index) => {
    const img = document.createElement("img");
    img.src = file;
    img.alt = `Leatherwork image ${index + 1}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("click", () => openLightbox(index));
    gallery.appendChild(img);
  });

  closeLightbox?.addEventListener("click", () => lightbox.classList.add("hidden"));
  nextLightbox?.addEventListener("click", (event) => {
    event.stopPropagation();
    showNext();
  });
  prevLightbox?.addEventListener("click", (event) => {
    event.stopPropagation();
    showPrev();
  });
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      lightbox.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.classList.contains("hidden")) return;
    if (event.key === "Escape") lightbox.classList.add("hidden");
    if (event.key === "ArrowRight") showNext();
    if (event.key === "ArrowLeft") showPrev();
  });
}

loadFeaturedWork();
buildLibraryGallery();
