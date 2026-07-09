/**
 * file.meta UI - رابط کاربری متادیتای فایل
 * 
 * نمایش اطلاعات:
 * - اطلاعات پایه فایل (نام، حجم، تاریخ‌ها)
 * - نوع MIME و encoding
 * - SHA256 (تنها هش موجود)
 * - متادیتای صوت/ویدیو/سند/متن/آرشیو/SQLite
 * - GPS (اگر موجود باشد)
 * - xattrs (اگر موجود باشد)
 * - داده‌های پنهان binwalk (اگر موجود باشد)
 */
(function () {
  const { useEffect, useState } = React;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Theme Sync
  // ═══════════════════════════════════════════════════════════════════════════════

  const THEME_MAP = {
    "--bg": "--main-bg",
    "--card": "--main-panel",
    "--panel": "--main-panel",
    "--border": "--panel-border",
    "--text": "--text",
    "--muted": "--text-muted",
    "--accent": "--accent",
    "--accent-soft": "--accent-soft",
  };

  function syncThemeFromParent() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc) return;
      const theme = parentDoc.documentElement.dataset.theme || parentDoc.body?.dataset.theme;
      if (theme) {
        document.documentElement.dataset.theme = theme;
      }
      const computed = parentDoc.defaultView.getComputedStyle(parentDoc.documentElement);
      Object.entries(THEME_MAP).forEach(([target, source]) => {
        const val = computed.getPropertyValue(source);
        if (val) document.documentElement.style.setProperty(target, val.trim());
      });
    } catch (err) {
      // best-effort
    }
  }

  function useThemeSync() {
    useEffect(() => {
      syncThemeFromParent();
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc) return undefined;
      const observer = new MutationObserver(syncThemeFromParent);
      try {
        observer.observe(parentDoc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      } catch (err) {}
      return () => observer.disconnect();
    }, []);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Helper Functions
  // ═══════════════════════════════════════════════════════════════════════════════

  function formatSize(bytes) {
    if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let val = Number(bytes);
    let i = 0;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i += 1;
    }
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("fa-IR");
    } catch {
      return isoStr;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Reusable Components
  // ═══════════════════════════════════════════════════════════════════════════════

  function KeyValue({ label, value, mono = false }) {
    const display = value === undefined || value === null || value === "" ? "—" : value;
    const cls = mono ? "kv-v mono" : "kv-v";
    return React.createElement(
      "div",
      { className: "kv" },
      [
        React.createElement("div", { className: "kv-k", key: "k" }, label),
        React.createElement("div", { className: cls, key: "v", title: String(display) }, String(display)),
      ]
    );
  }

  function Section({ title, children, badge, badgeColor, defaultOpen = true, icon }) {
    const [open, setOpen] = useState(defaultOpen);
    const badgeCls = badgeColor ? `pill ${badgeColor}` : "pill";
    return React.createElement(
      "div",
      { className: "section" },
      [
        React.createElement(
          "button",
          {
            key: "hdr",
            className: "section-toggle",
            onClick: () => setOpen((prev) => !prev),
            type: "button",
          },
          [
            React.createElement("span", { className: "section-title", key: "t" }, [
              icon ? React.createElement("span", { className: "section-icon", key: "i" }, icon) : null,
              title
            ]),
            React.createElement(
              "span",
              { className: "section-meta", key: "m" },
              [
                badge ? React.createElement("span", { className: badgeCls, key: "b" }, badge) : null,
                React.createElement("span", { className: "chevron" + (open ? " open" : ""), key: "c" }, open ? "▴" : "▾"),
              ].filter(Boolean)
            ),
          ]
        ),
        open ? React.createElement("div", { className: "section-body", key: "body" }, children) : null,
      ]
    );
  }

  function JsonBlock({ value, emptyLabel }) {
    if (!value || (typeof value === "object" && !Object.keys(value).length)) {
      return React.createElement("div", { className: "muted" }, emptyLabel || "داده‌ای موجود نیست.");
    }
    return React.createElement("pre", { className: "code" }, JSON.stringify(value, null, 2));
  }

  function Pills({ items, tone = "muted" }) {
    if (!items || !items.length) return null;
    return React.createElement(
      "div",
      { className: "pill-row" },
      items.map((item, idx) =>
        React.createElement("span", { key: `${item}-${idx}`, className: `pill ${tone}` }, item)
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Map Section for GPS
  // ═══════════════════════════════════════════════════════════════════════════════

  function MapSection({ location }) {
    const [provider, setProvider] = useState("osm");
    if (!location || location.latitude === undefined || location.longitude === undefined) return null;
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}`;
    const gglSrc = `https://www.google.com/maps?q=${lat},${lon}&output=embed`;
    const mapSrc = provider === "google" ? gglSrc : osmSrc;

    return React.createElement(
      Section,
      { title: "موقعیت جغرافیایی", defaultOpen: true, icon: "📍" },
      React.createElement(
        "div",
        { className: "map-grid" },
        [
          React.createElement(
            "div",
            { className: "kv-grid", key: "info" },
            [
              React.createElement(KeyValue, { label: "عرض جغرافیایی", value: lat.toFixed(6), key: "lat" }),
              React.createElement(KeyValue, { label: "طول جغرافیایی", value: lon.toFixed(6), key: "lon" }),
              location.altitude !== undefined && location.altitude !== null
                ? React.createElement(KeyValue, { label: "ارتفاع", value: `${location.altitude}m`, key: "alt" })
                : null,
              location.source 
                ? React.createElement(KeyValue, { label: "منبع", value: location.source, key: "src" }) 
                : null,
              React.createElement(
                "div",
                { className: "kv", key: "provider" },
                [
                  React.createElement("div", { className: "kv-k", key: "k" }, "نقشه"),
                  React.createElement(
                    "select",
                    {
                      className: "select",
                      key: "sel",
                      value: provider,
                      onChange: (e) => setProvider(e.target.value),
                    },
                    [
                      React.createElement("option", { key: "osm", value: "osm" }, "OpenStreetMap"),
                      React.createElement("option", { key: "google", value: "google" }, "Google Maps"),
                    ]
                  ),
                ]
              ),
            ].filter(Boolean)
          ),
          React.createElement("iframe", {
            key: "map",
            className: "map-frame",
            src: mapSrc,
            loading: "lazy",
            title: "location-map",
          }),
        ]
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Archive Preview Table
  // ═══════════════════════════════════════════════════════════════════════════════

  function ArchivePreview({ archive }) {
    if (!archive) return null;
    const rows = archive.entries_preview || [];
    return React.createElement(
      "div",
      { className: "table" },
      [
        React.createElement(
          "div",
          { className: "table-head", key: "h" },
          [
            React.createElement("div", { className: "col name", key: "n" }, "نام"),
            React.createElement("div", { className: "col size", key: "s" }, "حجم"),
          ]
        ),
        rows.length
          ? rows.map((row, idx) =>
              React.createElement(
                "div",
                { className: "table-row", key: `${row.name || idx}` },
                [
                  React.createElement("div", { className: "col name", key: "n" }, row.name || "-"),
                  React.createElement("div", { className: "col size", key: "s" }, formatSize(row.size)),
                ]
              )
            )
          : React.createElement("div", { className: "muted", style: { padding: "6px 0" }, key: "e" }, "آیتمی یافت نشد."),
      ]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Main App Component
  // ═══════════════════════════════════════════════════════════════════════════════

  function App(props) {
    useThemeSync();

    const run = props.run || {};
    const envelope = run.result || run;
    const data = envelope.data || {};
    const channels = envelope.channels || {};
    
    // استخراج کانال UI - از چندین منبع ممکن
    const ui = channels.ui || data.ui || {};
    
    // استخراج متادیتا از همه منابع ممکن
    const meta = data.metadata || ui.metadata || envelope.metadata || {};
    const warnings = (envelope.warnings || data.warnings || ui.warnings || []).filter(Boolean);
    
    // استخراج stats از همه منابع ممکن
    const stats = data.stats || ui.file || {};
    
    // استخراج file info از UI یا data
    const file = ui.file || {
      filename: data.filename,
      filepath: data.filepath,
      size: data.stats?.size_bytes || stats.size_bytes,
      size_formatted: data.stats?.size_formatted || stats.size_formatted,
      modified_at: data.stats?.modified_at || stats.modified_at,
    };
    
    // استخراج type info از UI یا data
    const typeInfo = ui.type || {
      mime_type: data.mime_type,
      kind: data.kind,
      extension: data.extension,
      description: data.mime_description,
    };

    // Data extraction با fallback chain کامل
    const filename = file.filename || data.filename || envelope.filename || "نامشخص";
    const filepath = file.filepath || data.filepath || envelope.filepath || "";
    const parentDir = data.parent_dir || envelope.parent_dir || "";
    const mimeType = typeInfo.mime_type || data.mime_type || envelope.mime_type || "";
    const mimeDesc = typeInfo.description || data.mime_description || envelope.mime_description || "";
    const encoding = data.encoding || envelope.encoding || "";
    const extension = typeInfo.extension || data.extension || envelope.extension || "";
    const kind = typeInfo.kind || data.kind || envelope.kind || "";
    const sizeFormatted = file.size_formatted || stats.size_formatted || data.stats?.size_formatted || formatSize(file.size || stats.size_bytes || data.stats?.size_bytes);
    const modifiedAt = file.modified_at || stats.modified_at || data.stats?.modified_at;
    const createdAt = stats.created_at || data.stats?.created_at;
    const accessedAt = stats.accessed_at || data.stats?.accessed_at;
    const isSymlink = stats.is_symlink || data.stats?.is_symlink;
    const sha256 = ui.sha256 || data.sha256 || envelope.sha256;
    const location = ui.location || data.location || envelope.location;
    const hiddenData = ui.hidden_data || data.hidden_data || envelope.hidden_data;
    const xattrs = data.xattrs || envelope.xattrs || {};

    // ExifTool status (v2.4.0)
    const channelMeta = channels.metadata || {};
    const hasExiftool = channelMeta.has_exiftool || false;
    const exiftoolTagsCount = channelMeta.exiftool_tags_count || 0;
    const lensModel = channelMeta.lens_model;
    const serialNumber = channelMeta.serial_number;
    const shutterCount = channelMeta.shutter_count;
    const focusMode = channelMeta.focus_mode;

    // Kind color mapping
    const kindColor = {
      image: "accent",
      audio: "warning",
      video: "warning",
      document: "success",
      archive: "muted",
      database: "accent",
      text: "muted",
    }[kind] || "muted";

    // Audio probe data
    const audioMeta = meta.audio || {};
    const audioProbe = audioMeta.probe || null;

    // Video probe data
    const videoMeta = meta.video || {};

    return React.createElement(
      "div",
      { className: "app" },
      [
        // Header
        React.createElement(
          "div",
          { className: "header", key: "hdr" },
          [
            React.createElement("div", { className: "title", key: "t" }, "📄 ابزار file.meta"),
            React.createElement(
              "div",
              { className: "header-badges", key: "badges" },
              [
                React.createElement(Pills, {
                  key: "p",
                  tone: kindColor,
                  items: [kind, mimeType].filter(Boolean),
                }),
                // ExifTool badge (v2.4.0)
                hasExiftool && kind === "image"
                  ? React.createElement("span", { 
                      className: "pill success", 
                      key: "et",
                      title: `ExifTool: ${exiftoolTagsCount} تگ استخراج شده`
                    }, `🔬 ExifTool (${exiftoolTagsCount})`)
                  : null,
              ].filter(Boolean)
            ),
          ]
        ),

        // Top Grid: File Info + Type Info
        React.createElement(
          "div",
          { className: "grid two", key: "top" },
          [
            // File System Info Card
            React.createElement(
              "div",
              { className: "card", key: "fs" },
              [
                React.createElement("div", { className: "card-title", key: "ct" }, "📁 اطلاعات فایل‌سیستم"),
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "grid" },
                  [
                    React.createElement(KeyValue, { label: "نام فایل", value: filename, key: "fn" }),
                    React.createElement(KeyValue, { label: "حجم", value: sizeFormatted, key: "sz" }),
                    React.createElement(KeyValue, { label: "پسوند", value: extension || "—", key: "ext" }),
                    parentDir ? React.createElement(KeyValue, { label: "پوشه", value: parentDir, key: "dir" }) : null,
                  ].filter(Boolean)
                ),
              ]
            ),
            // Type Info Card
            React.createElement(
              "div",
              { className: "card", key: "type" },
              [
                React.createElement("div", { className: "card-title", key: "ct" }, "🔍 اطلاعات نوع"),
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "grid" },
                  [
                    React.createElement(KeyValue, { label: "نوع MIME", value: mimeType || "—", key: "mime" }),
                    React.createElement(KeyValue, { label: "دسته", value: kind || "—", key: "kind" }),
                    mimeDesc ? React.createElement(KeyValue, { label: "توضیح", value: mimeDesc, key: "desc" }) : null,
                    encoding ? React.createElement(KeyValue, { label: "Encoding", value: encoding, key: "enc" }) : null,
                  ].filter(Boolean)
                ),
              ]
            ),
          ]
        ),

        // Timestamps Section
        (modifiedAt || createdAt || accessedAt) 
          ? React.createElement(
              Section,
              { title: "تاریخ‌ها", defaultOpen: false, icon: "🕐", key: "dates" },
              React.createElement(
                "div",
                { className: "kv-grid" },
                [
                  modifiedAt ? React.createElement(KeyValue, { label: "آخرین تغییر", value: formatDate(modifiedAt), key: "mod" }) : null,
                  createdAt ? React.createElement(KeyValue, { label: "ایجاد شده", value: formatDate(createdAt), key: "cre" }) : null,
                  accessedAt ? React.createElement(KeyValue, { label: "آخرین دسترسی", value: formatDate(accessedAt), key: "acc" }) : null,
                  isSymlink !== undefined ? React.createElement(KeyValue, { label: "Symlink?", value: isSymlink ? "بله" : "خیر", key: "sym" }) : null,
                ].filter(Boolean)
              )
            )
          : null,

        // SHA256 Hash
        sha256 
          ? React.createElement(
              Section,
              { title: "هش SHA256", defaultOpen: true, icon: "🔐", key: "hash" },
              React.createElement(
                "div",
                { className: "sha256-display" },
                React.createElement("code", { className: "sha256-code" }, sha256)
              )
            )
          : null,

        // GPS Location
        location ? React.createElement(MapSection, { location, key: "map" }) : null,

        // Extended Attributes (xattr)
        Object.keys(xattrs).length > 0
          ? React.createElement(
              Section,
              { title: "ویژگی‌های افزوده (xattr)", defaultOpen: false, icon: "📌", key: "xattr" },
              React.createElement(JsonBlock, { value: xattrs, emptyLabel: "ویژگی افزوده‌ای یافت نشد." })
            )
          : null,

        // Hidden Data (binwalk)
        hiddenData && hiddenData.hit_count > 0
          ? React.createElement(
              Section,
              { 
                title: "داده‌های پنهان (binwalk)", 
                badge: hiddenData.suspicious ? "⚠️ مشکوک" : `${hiddenData.hit_count} مورد`,
                badgeColor: hiddenData.suspicious ? "warning" : "muted",
                defaultOpen: hiddenData.suspicious, 
                icon: "🔎", 
                key: "hidden" 
              },
              React.createElement(JsonBlock, { value: hiddenData.binwalk_hits })
            )
          : null,

        // Audio Metadata
        meta.audio
          ? React.createElement(
              Section,
              { 
                title: "متادیتای صوت", 
                badge: audioMeta.length ? `${Math.round(audioMeta.length)}s` : null, 
                defaultOpen: kind === "audio", 
                icon: "🎵",
                key: "audio" 
              },
              [
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "kv" },
                  [
                    audioMeta.length ? React.createElement(KeyValue, { label: "طول (ثانیه)", value: Math.round(audioMeta.length * 10) / 10, key: "len" }) : null,
                    audioMeta.bitrate ? React.createElement(KeyValue, { label: "Bitrate", value: audioMeta.bitrate, key: "br" }) : null,
                    audioMeta.sample_rate ? React.createElement(KeyValue, { label: "Sample Rate", value: audioMeta.sample_rate, key: "sr" }) : null,
                    audioMeta.channels ? React.createElement(KeyValue, { label: "Channels", value: audioMeta.channels, key: "ch" }) : null,
                  ].filter(Boolean)
                ),
                audioMeta.tags
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "tags" },
                      [
                        React.createElement("summary", { key: "s" }, "تگ‌ها"),
                        React.createElement(JsonBlock, { value: audioMeta.tags, key: "j" }),
                      ]
                    )
                  : null,
                audioProbe
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "probe" },
                      [
                        React.createElement("summary", { key: "s" }, "ffprobe"),
                        React.createElement(JsonBlock, { value: audioProbe, key: "j" }),
                      ]
                    )
                  : null,
              ].filter(Boolean)
            )
          : null,

        // Video Metadata
        meta.video
          ? React.createElement(
              Section,
              { 
                title: "متادیتای ویدیو", 
                badge: videoMeta.format?.duration ? `${Math.round(Number(videoMeta.format.duration))}s` : null, 
                defaultOpen: kind === "video", 
                icon: "🎬",
                key: "video" 
              },
              [
                videoMeta.format
                  ? React.createElement(
                      "div",
                      { className: "kv-grid", key: "kv" },
                      [
                        React.createElement(KeyValue, { label: "Format", value: videoMeta.format.format_name, key: "fmt" }),
                        React.createElement(KeyValue, { label: "مدت", value: videoMeta.format.duration, key: "dur" }),
                        React.createElement(KeyValue, { label: "بیت‌ریت", value: videoMeta.format.bit_rate, key: "bit" }),
                      ].filter(Boolean)
                    )
                  : null,
                videoMeta.streams
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "streams" },
                      [
                        React.createElement("summary", { key: "s" }, "جریان‌ها"),
                        React.createElement(JsonBlock, { value: videoMeta.streams, key: "j" }),
                      ]
                    )
                  : null,
              ].filter(Boolean)
            )
          : null,

        // Document/PDF Metadata
        meta.document
          ? React.createElement(
              Section,
              { 
                title: "متادیتای PDF/سند", 
                badge: meta.document.page_count ? `${meta.document.page_count} صفحه` : null, 
                defaultOpen: kind === "document", 
                icon: "📑",
                key: "doc" 
              },
              [
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "kv" },
                  [
                    React.createElement(KeyValue, { label: "تعداد صفحات", value: meta.document.page_count, key: "pc" }),
                    React.createElement(KeyValue, {
                      label: "رمزگذاری شده؟",
                      value: meta.document.encrypted ? "بله" : "خیر",
                      key: "enc",
                    }),
                  ]
                ),
                meta.document.document_info
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "info" },
                      [
                        React.createElement("summary", { key: "s" }, "اطلاعات سند"),
                        React.createElement(JsonBlock, { value: meta.document.document_info, key: "j" }),
                      ]
                    )
                  : null,
              ].filter(Boolean)
            )
          : null,

        // Text Metadata
        meta.text
          ? React.createElement(
              Section,
              { 
                title: "متادیتای متن", 
                badge: meta.text.line_count ? `${meta.text.line_count} خط` : null, 
                defaultOpen: false, 
                icon: "📝",
                key: "text" 
              },
              React.createElement(
                "div",
                { className: "kv-grid" },
                [
                  React.createElement(KeyValue, { label: "تعداد خطوط", value: meta.text.line_count, key: "lines" }),
                  React.createElement(KeyValue, { label: "تعداد کلمات", value: meta.text.word_count, key: "words" }),
                  React.createElement(KeyValue, { label: "تعداد کاراکتر", value: meta.text.char_count, key: "chars" }),
                  meta.text.encoding ? React.createElement(KeyValue, { label: "Encoding", value: meta.text.encoding, key: "enc" }) : null,
                  React.createElement(KeyValue, {
                    label: "برش داده شده؟",
                    value: meta.text.truncated ? "بله" : "خیر",
                    key: "trunc",
                  }),
                ].filter(Boolean)
              )
            )
          : null,

        // Office Metadata
        meta.office
          ? React.createElement(
              Section,
              { title: "متادیتای Office", defaultOpen: false, icon: "📊", key: "office" },
              React.createElement(JsonBlock, { value: meta.office })
            )
          : null,

        // EPUB Metadata
        meta.epub
          ? React.createElement(
              Section,
              { title: "متادیتای EPUB", defaultOpen: false, icon: "📚", key: "epub" },
              React.createElement(JsonBlock, { value: meta.epub })
            )
          : null,

        // Archive Metadata
        meta.archive
          ? React.createElement(
              Section,
              { 
                title: "آرشیو / بسته", 
                badge: meta.archive.entry_count ? `${meta.archive.entry_count} آیتم` : null, 
                defaultOpen: false, 
                icon: "📦",
                key: "archive" 
              },
              React.createElement(ArchivePreview, { archive: meta.archive })
            )
          : null,

        // SQLite Metadata
        meta.sqlite
          ? React.createElement(
              Section,
              { 
                title: "متادیتای SQLite", 
                badge: meta.sqlite.tables?.length ? `${meta.sqlite.tables.length} جدول` : null, 
                defaultOpen: false, 
                icon: "🗄️",
                key: "sqlite" 
              },
              [
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "kv" },
                  [
                    React.createElement(KeyValue, { label: "تعداد جداول", value: meta.sqlite.table_count, key: "tc" }),
                    meta.sqlite.views?.length ? React.createElement(KeyValue, { label: "تعداد View", value: meta.sqlite.views.length, key: "vc" }) : null,
                  ].filter(Boolean)
                ),
                meta.sqlite.tables
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "tables" },
                      [
                        React.createElement("summary", { key: "s" }, "جداول"),
                        React.createElement(Pills, { items: meta.sqlite.tables, tone: "accent", key: "p" }),
                      ]
                    )
                  : null,
                meta.sqlite.row_count_sample
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "rows" },
                      [
                        React.createElement("summary", { key: "s" }, "تعداد ردیف‌ها (نمونه)"),
                        React.createElement(JsonBlock, { value: meta.sqlite.row_count_sample, key: "j" }),
                      ]
                    )
                  : null,
              ].filter(Boolean)
            )
          : null,

        // Image Metadata (if exists - though image.meta is recommended)
        meta.image
          ? React.createElement(
              Section,
              { 
                title: "متادیتای تصویر", 
                badge: meta.image.width && meta.image.height ? `${meta.image.width}×${meta.image.height}` : null, 
                defaultOpen: kind === "image", 
                icon: "🖼️",
                key: "image" 
              },
              [
                // Basic Image Info
                React.createElement(
                  "div",
                  { className: "kv-grid", key: "kv" },
                  [
                    React.createElement(KeyValue, { label: "ابعاد", value: `${meta.image.width} × ${meta.image.height}`, key: "dim" }),
                    React.createElement(KeyValue, { label: "فرمت", value: meta.image.format, key: "fmt" }),
                    React.createElement(KeyValue, { label: "Mode", value: meta.image.mode, key: "mode" }),
                  ]
                ),
                
                // EXIF Clean (Camera info, dates, etc)
                meta.image.exif_clean
                  ? React.createElement(
                      "details",
                      { className: "fold", open: true, key: "exif" },
                      [
                        React.createElement("summary", { key: "s" }, "📷 EXIF اصلی"),
                        React.createElement(
                          "div",
                          { className: "kv-grid", key: "kv" },
                          [
                            meta.image.exif_clean.Make 
                              ? React.createElement(KeyValue, { label: "سازنده", value: String(meta.image.exif_clean.Make).replace(/\x00/g, '').trim(), key: "make" }) 
                              : null,
                            meta.image.exif_clean.Model 
                              ? React.createElement(KeyValue, { label: "مدل دوربین", value: String(meta.image.exif_clean.Model).replace(/\x00/g, '').trim(), key: "model" }) 
                              : null,
                            meta.image.exif_clean.DateTime 
                              ? React.createElement(KeyValue, { label: "تاریخ عکسبرداری", value: meta.image.exif_clean.DateTime, key: "dt" }) 
                              : null,
                            meta.image.exif_clean.Software 
                              ? React.createElement(KeyValue, { label: "نرم‌افزار", value: String(meta.image.exif_clean.Software).replace(/\x00/g, '').trim(), key: "sw" }) 
                              : null,
                            meta.image.exif_clean.Orientation !== undefined 
                              ? React.createElement(KeyValue, { label: "جهت", value: meta.image.exif_clean.Orientation, key: "ori" }) 
                              : null,
                          ].filter(Boolean)
                        ),
                      ]
                    )
                  : null,
                
                // ExifTool Advanced Data (v2.4.0)
                meta.image.exif_clean && meta.image.exif_clean._sources && meta.image.exif_clean._sources.exiftool
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "exiftool" },
                      [
                        React.createElement("summary", { key: "s" }, [
                          "🔬 ExifTool پیشرفته",
                          React.createElement("span", { className: "pill accent", style: { marginRight: "8px" }, key: "b" }, 
                            `${meta.image.exif_clean._sources.exiftool_tags || 0} تگ`
                          ),
                        ]),
                        React.createElement(
                          "div",
                          { className: "kv-grid", key: "kv" },
                          [
                            meta.image.exif_clean.lens_model 
                              ? React.createElement(KeyValue, { label: "مدل لنز", value: meta.image.exif_clean.lens_model, key: "lens" }) 
                              : null,
                            meta.image.exif_clean.serial_number 
                              ? React.createElement(KeyValue, { label: "شماره سریال", value: meta.image.exif_clean.serial_number, key: "serial" }) 
                              : null,
                            meta.image.exif_clean.shutter_count 
                              ? React.createElement(KeyValue, { label: "شمارش شاتر", value: meta.image.exif_clean.shutter_count, key: "shutter" }) 
                              : null,
                            meta.image.exif_clean.focus_mode 
                              ? React.createElement(KeyValue, { label: "حالت فوکوس", value: meta.image.exif_clean.focus_mode, key: "focus" }) 
                              : null,
                          ].filter(Boolean)
                        ),
                        // MakerNotes
                        meta.image.exif_clean.maker_notes
                          ? React.createElement(
                              "details",
                              { className: "fold", key: "maker" },
                              [
                                React.createElement("summary", { key: "s" }, "MakerNotes (اطلاعات سازنده)"),
                                React.createElement(JsonBlock, { value: meta.image.exif_clean.maker_notes, key: "j" }),
                              ]
                            )
                          : null,
                        // XMP
                        meta.image.exif_clean.xmp
                          ? React.createElement(
                              "details",
                              { className: "fold", key: "xmp" },
                              [
                                React.createElement("summary", { key: "s" }, "XMP (Adobe Metadata)"),
                                React.createElement(JsonBlock, { value: meta.image.exif_clean.xmp, key: "j" }),
                              ]
                            )
                          : null,
                        // IPTC
                        meta.image.exif_clean.iptc
                          ? React.createElement(
                              "details",
                              { className: "fold", key: "iptc" },
                              [
                                React.createElement("summary", { key: "s" }, "IPTC (اطلاعات خبرنگاری)"),
                                React.createElement(JsonBlock, { value: meta.image.exif_clean.iptc, key: "j" }),
                              ]
                            )
                          : null,
                      ].filter(Boolean)
                    )
                  : null,

                // GPS from image
                meta.image.gps && meta.image.gps.latitude
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "gps" },
                      [
                        React.createElement("summary", { key: "s" }, "📍 GPS تصویر"),
                        React.createElement(
                          "div",
                          { className: "kv-grid", key: "kv" },
                          [
                            React.createElement(KeyValue, { label: "عرض جغرافیایی", value: meta.image.gps.latitude, key: "lat" }),
                            React.createElement(KeyValue, { label: "طول جغرافیایی", value: meta.image.gps.longitude, key: "lon" }),
                            meta.image.gps.altitude 
                              ? React.createElement(KeyValue, { label: "ارتفاع", value: `${meta.image.gps.altitude}m`, key: "alt" }) 
                              : null,
                          ].filter(Boolean)
                        ),
                      ]
                    )
                  : null,

                // Full EXIF (raw)
                meta.image.exif_raw
                  ? React.createElement(
                      "details",
                      { className: "fold", key: "raw" },
                      [
                        React.createElement("summary", { key: "s" }, "EXIF خام (کامل)"),
                        React.createElement(JsonBlock, { value: meta.image.exif_raw, key: "j" }),
                      ]
                    )
                  : null,

                React.createElement(
                  "div",
                  { className: "muted tool-hint", key: "hint" },
                  "💡 برای تحلیل کامل‌تر تصویر (رنگ غالب، pHash، کیفیت) از ابزار image.meta استفاده کنید"
                ),
              ].filter(Boolean)
            )
          : null,

        // Warnings
        warnings.length
          ? React.createElement(
              Section,
              { title: "هشدارها", badge: `${warnings.length}`, badgeColor: "warning", defaultOpen: false, icon: "⚠️", key: "warn" },
              React.createElement(Pills, { items: warnings, tone: "warning" })
            )
          : null,

        // Tool hints
        React.createElement(
          "div",
          { className: "tool-hints", key: "hints" },
          [
            React.createElement("span", { className: "muted", key: "t" }, "💡 ابزارهای تخصصی:"),
            React.createElement("span", { className: "hint-tool", key: "1" }, "image.meta"),
            React.createElement("span", { className: "hint-sep", key: "s1" }, "تصویر"),
            React.createElement("span", { className: "hint-tool", key: "2" }, "file.secure"),
            React.createElement("span", { className: "hint-sep", key: "s2" }, "امنیت"),
            React.createElement("span", { className: "hint-tool", key: "3" }, "file.identify"),
            React.createElement("span", { className: "hint-sep", key: "s3" }, "شناسایی"),
          ]
        ),
      ].filter(Boolean)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════════════════════

  window.ToolUI = {
    render: function (payload) {
      var mount = (payload && payload.mount) || document.getElementById("app") || document.body;
      var run = (payload && (payload.run || payload)) || {};
      ReactDOM.render(React.createElement(App, { run: run }), mount);
    },
  };
  if (typeof module !== "undefined") module.exports = { default: App, render: window.ToolUI.render };
})();
