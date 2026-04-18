(function () {
  "use strict";

  var PAGE_SIZE = 12;
  var DEFAULT_CATEGORIES = ["AI", "ML", "Tools", "ChatGPT", "Generative AI", "Research", "Business"];
  var AI_ALLOWED_CATEGORIES = new Set(DEFAULT_CATEGORIES.map(function (c) { return String(c).toLowerCase(); }));
  var AI_KEYWORDS = [
    "artificial intelligence",
    "ai ",
    " ai",
    "machine learning",
    "ml ",
    " llm",
    "llm ",
    "large language model",
    "gpt",
    "chatgpt",
    "openai",
    "anthropic",
    "google deepmind",
    "deepmind",
    "gemini",
    "claude",
    "mistral",
    "llama",
    "transformer",
    "diffusion",
    "generative",
    "rag",
    "retrieval augmented",
    "agentic",
    "ai agent",
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  function toInt(x, fallback) {
    var n = parseInt(String(x || ""), 10);
    return isNaN(n) ? fallback : n;
  }

  function normalizeCategory(c) {
    var s = String(c || "").trim();
    if (!s) return "AI";
    return s;
  }

  function readingTime(article) {
    var raw = String((article && article.summary) || "") + " " + String((article && article.description) || "");
    var words = raw.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200)) + " min read";
  }

  function renderSkeletons() {
    var grid = $("#article-grid");
    if (!grid) return;
    var html = new Array(6)
      .fill(0)
      .map(function () {
        return (
          '<a class="card card--skeleton" aria-hidden="true">' +
          '<div class="card__media skeleton"></div>' +
          '<div class="card__body">' +
          '<div class="skeleton" style="height:12px;width:60%;border-radius:6px;margin-bottom:8px"></div>' +
          '<div class="skeleton" style="height:18px;width:90%;border-radius:6px;margin-bottom:6px"></div>' +
          '<div class="skeleton" style="height:18px;width:75%;border-radius:6px;margin-bottom:12px"></div>' +
          '<div class="skeleton" style="height:13px;width:50%;border-radius:6px"></div>' +
          "</div>" +
          "</a>"
        );
      })
      .join("");
    grid.classList.remove("stagger-in");
    grid.innerHTML = html;
  }

  function isAiArticle(a) {
    if (!a) return false;
    var cat = String(a.category || "").trim().toLowerCase();
    if (cat && AI_ALLOWED_CATEGORIES.has(cat)) return true;
    var text =
      String(a.title || "") +
      " " +
      String(a.keywords || "") +
      " " +
      String(a.summary || "") +
      " " +
      String(a.description || "") +
      " " +
      String(a.metaDescription || "");
    text = text.toLowerCase();
    for (var i = 0; i < AI_KEYWORDS.length; i++) {
      if (text.indexOf(AI_KEYWORDS[i]) >= 0) return true;
    }
    return false;
  }

  function articleUrl(article) {
    var slug = String(article.slug || "").trim();
    if (!slug) return "index.html";
    return "articles/" + encodeURIComponent(slug) + "/";
  }

  function safeDate(d) {
    var raw = d || "";
    if (!raw) return null;
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  function prettyDate(d) {
    var dt = safeDate(d);
    if (!dt) return "";
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function canonicalBaseFromSite(site) {
    var c = site && site.canonicalOrigin ? String(site.canonicalOrigin).trim() : "";
    if (!c) return "";
    return c.replace(/\/+$/, "");
  }

  function applyCanonicalHome_(site) {
    var base = canonicalBaseFromSite(site);
    var canon = base ? base + "/ai-news/" : "";
    var cl = $("#canonical-link");
    var og = $("#og-url");
    if (cl) cl.href = canon;
    if (og) og.content = canon;
    if (site && site.name) {
      document.title = String(site.name) + " — Artificial Intelligence News";
    }

    var schemaEl = $("#site-schema");
    if (!schemaEl) return;
    try {
      var obj = JSON.parse(schemaEl.textContent || "{}");
      var g = obj["@graph"] || [];
      g.forEach(function (node) {
        if (node && node["@type"] === "Organization") {
          node["@id"] = (base ? base + "/" : "") + "#organization";
          node.url = base ? base + "/" : "";
          node.name = site && site.name ? site.name : "waapply";
        }
        if (node && node["@type"] === "WebSite") {
          node["@id"] = (base ? base + "/" : "") + "#website";
          node.url = canon;
          node.name = site && site.name ? site.name : "waapply";
          node.publisher = { "@id": (base ? base + "/" : "") + "#organization" };
        }
      });
      schemaEl.textContent = JSON.stringify(obj);
    } catch (e) {
      // ignore
    }
  }

  function getQuery() {
    var p = new URLSearchParams(window.location.search);
    return {
      q: String(p.get("q") || "").trim(),
      cat: String(p.get("cat") || "").trim(),
      page: Math.max(1, toInt(p.get("page"), 1)),
    };
  }

  function setQuery(next) {
    var p = new URLSearchParams(window.location.search);
    if (next.q != null) {
      if (String(next.q).trim()) p.set("q", String(next.q).trim());
      else p.delete("q");
    }
    if (next.cat != null) {
      if (String(next.cat).trim() && String(next.cat).trim() !== "all") p.set("cat", String(next.cat).trim());
      else p.delete("cat");
    }
    if (next.page != null) {
      if (Number(next.page) > 1) p.set("page", String(next.page));
      else p.delete("page");
    }
    var url = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
    window.history.pushState({}, "", url);
  }

  function buildCategorySet(articles, site) {
    var out = new Set();
    var fromSite = (site && site.topics) || [];
    fromSite.forEach(function (t) {
      if (t) out.add(String(t));
    });
    DEFAULT_CATEGORIES.forEach(function (t) {
      out.add(t);
    });
    (articles || []).forEach(function (a) {
      if (a && a.category) out.add(String(a.category));
    });
    return Array.prototype.slice
      .call(out)
      .filter(Boolean)
      .filter(function (c) {
        return AI_ALLOWED_CATEGORIES.has(String(c).toLowerCase());
      });
  }

  function renderPills(categories, active) {
    var wrap = $("#category-pills");
    if (!wrap) return;
    var allBtn =
      '<button type="button" class="pill" data-cat="all" aria-pressed="' +
      (active === "all" ? "true" : "false") +
      '">All</button>';
    var html = [allBtn]
      .concat(
        categories.map(function (c) {
          var pressed = String(active || "all") === String(c) ? "true" : "false";
          return (
            '<button type="button" class="pill" data-cat="' +
            escapeHtml(c) +
            '" aria-pressed="' +
            pressed +
            '">' +
            escapeHtml(c) +
            "</button>"
          );
        })
      )
      .join("");
    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nextCat = btn.getAttribute("data-cat") || "all";
        setQuery({ cat: nextCat, page: 1 });
        hydrate();
      });
    });
  }

  function renderGrid(items) {
    var grid = $("#article-grid");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML =
        '<div class="card" style="grid-column: span 12; padding: 18px;">No results yet. Try a different query.</div>';
      return;
    }
    grid.innerHTML = items
      .map(function (a) {
        var url = articleUrl(a);
        var img = a.image || "";
        var title = a.title || "";
        var desc = a.metaDescription || a.description || a.summary || "";
        if (desc && String(desc).length > 180) desc = String(desc).slice(0, 177) + "…";
        return (
          '<a class="card" href="' +
          escapeHtml(url) +
          '" role="listitem">' +
          '<div class="card__media" aria-hidden="true">' +
          (img
            ? '<img loading="lazy" src="' + escapeHtml(img) + '" alt="' + escapeHtml(a.imageAlt || title) + '" />'
            : "") +
          "</div>" +
          '<div class="card__body">' +
          '<p class="card__kicker"><span class="badge">' +
          escapeHtml(normalizeCategory(a.category)) +
          "</span><span>" +
          escapeHtml(prettyDate(a.publishedAt)) +
          "</span><span>" +
          '<span class="card__read-time">' +
          escapeHtml(readingTime(a)) +
          "</span>" +
          "</span><span>" +
          escapeHtml((a.source && a.source.name) || a.source || "") +
          "</span></p>" +
          '<h3 class="card__title">' +
          escapeHtml(title) +
          "</h3>" +
          '<p class="card__desc">' +
          escapeHtml(desc) +
          "</p>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
    grid.classList.add("stagger-in");
  }

  function renderFeatured(article) {
    var featured = $("#hero-featured");
    if (!featured) return;
    if (!article) {
      featured.innerHTML = "";
      return;
    }
    var title = article.title || "";
    var desc = article.metaDescription || article.description || article.summary || "";
    var image = article.image || "";
    var source = (article.source && article.source.name) || article.source || "";
    featured.innerHTML =
      '<a class="featured-card fade-in" href="' +
      escapeHtml(articleUrl(article)) +
      '">' +
      '<div class="featured-card__body">' +
      '<p class="card__kicker"><span class="badge">' +
      escapeHtml(normalizeCategory(article.category)) +
      "</span><span>" +
      escapeHtml(prettyDate(article.publishedAt)) +
      "</span><span>" +
      escapeHtml(source) +
      "</span></p>" +
      '<h2 class="featured-card__title">' +
      escapeHtml(title) +
      "</h2>" +
      '<p class="card__desc">' +
      escapeHtml(desc) +
      "</p>" +
      '<span class="featured-card__read">Read more →</span>' +
      "</div>" +
      '<div class="featured-card__media">' +
      (image ? '<img loading="lazy" src="' + escapeHtml(image) + '" alt="' + escapeHtml(article.imageAlt || title) + '" />' : "") +
      "</div>" +
      "</a>";
  }

  function initScrollTop() {
    var btn = $("#scroll-top");
    if (!btn) return;
    function onScroll() {
      btn.classList.toggle("is-visible", window.scrollY > 400);
    }
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function scoreMatch(article, q) {
    if (!q) return 1;
    var s = (article.title || "") + " " + (article.keywords || "") + " " + (article.summary || "") + " " + (article.description || "");
    s = String(s).toLowerCase();
    var tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8);
    var score = 0;
    tokens.forEach(function (t) {
      if (s.indexOf(t) >= 0) score += 1;
    });
    return score;
  }

  function filterAndSort(articles, query) {
    var q = String(query.q || "").trim();
    var cat = String(query.cat || "all").trim() || "all";
    var filtered = (articles || []).filter(function (a) {
      if (!a) return false;
      if (!isAiArticle(a)) return false;
      if (cat !== "all" && String(a.category || "") !== cat) return false;
      if (!q) return true;
      return scoreMatch(a, q) > 0;
    });
    filtered.sort(function (a, b) {
      var ta = safeDate(a.publishedAt) ? safeDate(a.publishedAt).getTime() : 0;
      var tb = safeDate(b.publishedAt) ? safeDate(b.publishedAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    if (q) {
      filtered.sort(function (a, b) {
        var sa = scoreMatch(a, q);
        var sb = scoreMatch(b, q);
        if (sb !== sa) return sb - sa;
        var ta = safeDate(a.publishedAt) ? safeDate(a.publishedAt).getTime() : 0;
        var tb = safeDate(b.publishedAt) ? safeDate(b.publishedAt).getTime() : 0;
        return tb - ta;
      });
    }
    return filtered;
  }

  function renderPager(total, page, pageSize) {
    var pager = $("#pager");
    if (!pager) return;
    var prev = $("#pager-prev");
    var next = $("#pager-next");
    var label = $("#pager-label");
    var pages = Math.max(1, Math.ceil(total / pageSize));
    pager.hidden = pages <= 1;
    if (label) label.textContent = "Page " + page + " / " + pages;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
    if (prev) {
      prev.onclick = function () {
        setQuery({ page: Math.max(1, page - 1) });
        hydrate();
      };
    }
    if (next) {
      next.onclick = function () {
        setQuery({ page: Math.min(pages, page + 1) });
        hydrate();
      };
    }
  }

  function hydrate() {
    renderSkeletons();
    return fetch("news.json", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var site = data.site || {};
        var articles = (data.articles || []).filter(isAiArticle);
        applyCanonicalHome_(site);
        $$("[data-site-name]").forEach(function (el) {
          el.textContent = site.name || "waapply";
        });

        var q = getQuery();
        var input = $("#search-input");
        if (input && q.q && input.value !== q.q) input.value = q.q;

        var categories = buildCategorySet(articles, site);
        renderPills(categories, q.cat || "all");

        var filtered = filterAndSort(articles, q);
        var featured = filtered.length ? filtered[0] : null;
        renderFeatured(featured);
        var listForGrid = featured ? filtered.slice(1) : filtered;
        var page = q.page || 1;
        var start = (page - 1) * PAGE_SIZE;
        var slice = listForGrid.slice(start, start + PAGE_SIZE);
        renderGrid(slice);
        renderPager(listForGrid.length, page, PAGE_SIZE);

        var meta = $("#latest-meta");
        if (meta) {
          meta.textContent =
            listForGrid.length +
            " articles" +
            (q.cat && q.cat !== "all" ? " · " + q.cat : "") +
            (q.q ? ' · search: "' + q.q + '"' : "");
        }
      })
      .catch(function () {
        var grid = $("#article-grid");
        if (grid) grid.innerHTML = '<div class="card" style="grid-column: span 12; padding: 18px;">Failed to load <code>news.json</code>.</div>';
      });
  }

  function initSearch() {
    var form = $("#search-form");
    var input = $("#search-input");
    if (!form || !input) return;
    var q = getQuery();
    if (q.q) input.value = q.q;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setQuery({ q: input.value, page: 1 });
      hydrate();
    });
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  initSearch();
  window.addEventListener("popstate", hydrate);
  initScrollTop();
  hydrate();
})();

