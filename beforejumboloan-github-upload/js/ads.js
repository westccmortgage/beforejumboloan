/* BeforeJumboLoan.com — consent-gated Google Ads + lead attribution */
(function () {
  "use strict";

  var ADS_ID = "AW-18417657219";
  var LEAD_DESTINATION = "AW-18417657219/LiA7CPWd4eocEIPLnM5E";
  var FORM_NAME = "before-jumbo-strategy-studio";
  var ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"];
  var PREFIX = "bjl_attr_";

  function hasConsent() {
    try { return localStorage.getItem("kw_consent") === "granted"; } catch (_) { return false; }
  }
  function safeGet(key) { try { return localStorage.getItem(key) || ""; } catch (_) { return ""; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function uid() { return "bjl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10); }

  function captureAttribution() {
    if (!hasConsent()) return;
    var qs = new URLSearchParams(window.location.search);
    ATTR_KEYS.forEach(function (key) {
      var value = qs.get(key);
      if (value) safeSet(PREFIX + key, value);
    });
    if (!safeGet(PREFIX + "landing_page")) safeSet(PREFIX + "landing_page", window.location.href);
  }

  function enrich(params) {
    if (!hasConsent()) return params;
    captureAttribution();
    ATTR_KEYS.forEach(function (key) {
      var value = safeGet(PREFIX + key);
      if (value) params.set(key, value);
    });
    params.set("landing_page", safeGet(PREFIX + "landing_page") || window.location.href);
    params.set("submission_page", window.location.href);
    return params;
  }

  function initAds() {
    if (!hasConsent()) return;
    captureAttribution();
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    if (!window.__bjlAdsConfigured) {
      window.__bjlAdsConfigured = true;
      window.gtag("js", new Date());
      window.gtag("config", ADS_ID);
    }
    if (!document.querySelector("script[data-bjl-google-ads]")) {
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ADS_ID);
      script.setAttribute("data-bjl-google-ads", "");
      document.head.appendChild(script);
    }
  }

  function fireLead(formName) {
    if (!hasConsent()) return;
    initAds();
    var id = uid();
    window.dataLayer.push({
      event: "bjl_lead_submit",
      form_name: formName,
      lead_event_id: id,
      page_location: window.location.href
    });
    window.gtag("event", "conversion", {
      send_to: LEAD_DESTINATION,
      value: 1.0,
      currency: "USD",
      transaction_id: id
    });
  }

  function installFetchHook() {
    if (window.__bjlLeadFetchHook || typeof window.fetch !== "function") return;
    window.__bjlLeadFetchHook = true;
    var originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      init = init || {};
      var nextInit = init;
      var trackedForm = "";
      try {
        if (String(init.method || "GET").toUpperCase() === "POST" && typeof init.body === "string") {
          var params = new URLSearchParams(init.body);
          var formName = params.get("form-name") || "";
          if (formName === FORM_NAME) {
            trackedForm = formName;
            params = enrich(params);
            nextInit = Object.assign({}, init, { body: params.toString() });
          }
        }
      } catch (_) {
        trackedForm = "";
      }

      return originalFetch(input, nextInit).then(function (response) {
        if (trackedForm && response && response.ok) fireLead(trackedForm);
        return response;
      });
    };
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("[data-consent-accept]") : null;
    if (!button) return;
    window.setTimeout(function () { initAds(); }, 0);
  });

  installFetchHook();
  if (hasConsent()) initAds();
})();
