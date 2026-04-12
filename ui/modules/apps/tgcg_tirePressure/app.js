angular.module('beamng.apps')
.directive('tgcgtirepressure', [function () {
  return {
    templateUrl: '/ui/modules/apps/tgcg_tirePressure/app.html',
    link: function (scope, element) {

      // ── Units ──────────────────────────────────────────────────────
      var UNITS = {
        PSI: { label:'PSI', fromPa:0.00014503773773020923, toPa:6894.757, max:50,  dec:0 },
        BAR: { label:'BAR', fromPa:0.00001,                toPa:100000,  max:3.5,  dec:1 },
        KPA: { label:'kPa', fromPa:0.001,                  toPa:1000,    max:350,  dec:0 },
      };
      var UNIT_CYCLE = ['PSI','BAR','KPA'];

      // ── Presets ────────────────────────────────────────────────────
      var PRESETS = {
        STREET:  { label:'STREET',  warnPsi:26, critPsi:18 },
        OFFROAD: { label:'OFFROAD', warnPsi:15, critPsi:8  },
        DRAG:    { label:'DRAG',    warnPsi:14, critPsi:8  },
        HEAVY:   { label:'HEAVY',   warnPsi:85, critPsi:65 },
        CUSTOM:  { label:'CUSTOM',  warnPsi:26, critPsi:18 },
      };
      scope.presetCycle        = ['STREET','OFFROAD','DRAG','HEAVY','CUSTOM'];
      scope.trailerPresetCycle = ['STREET','OFFROAD','DRAG','HEAVY'];
      scope.refreshRateOptions = [
        { v: 500,  l: '0.5s' },
        { v: 1000, l: '1s'   },
        { v: 2000, l: '2s'   },
        { v: 5000, l: '5s'   },
      ];

      // ── Settings defaults ─────────────────────────────────────────
      // Global — shared across all vehicles
      var GLOBAL_DEFAULTS = {
        uIdx:         0,
        tempUnitKey:  'F',
        tpIdx:        0,
        useNewUI:     true,
        showTemp:     true,
        showBrakeTemp:true,
        showWear:     false,
        refreshRate:  1000,
        hideDep:      false,
        hideTrailer:  false,
        lastPresetKey:   'STREET',
        lastCustomWarn:  26,
        lastCustomCrit:  18,
      };
      // Per-vehicle — only preset selection and custom thresholds
      var VEHICLE_DEFAULTS = {
        presetKey:     null,   // null = use global lastPresetKey
        customWarnPsi: null,   // null = use global lastCustomWarn
        customCritPsi: null,   // null = use global lastCustomCrit
      };

      var GLOBAL_KEY  = 'tgcg_tp_global';
      var globalPrefs = angular.copy(GLOBAL_DEFAULTS);
      var vehiclePrefs = angular.copy(VEHICLE_DEFAULTS);

      // Convenience — scope.settings still used by HTML, maps to global+vehicle merged
      var SETTINGS_DEFAULTS = {}; // kept for legacy compat, unused internally now
      scope.settings = {};
      function buildSettings() {
        // Merge global into scope.settings
        scope.settings.uIdx         = globalPrefs.uIdx;
        scope.settings.tempUnitKey  = globalPrefs.tempUnitKey;
        scope.settings.tpIdx        = globalPrefs.tpIdx;
        scope.settings.useNewUI     = globalPrefs.useNewUI;
        scope.settings.showTemp     = globalPrefs.showTemp;
        scope.settings.showBrakeTemp= globalPrefs.showBrakeTemp;
        scope.settings.showWear     = globalPrefs.showWear;
        scope.settings.refreshRate  = globalPrefs.refreshRate;
        scope.settings.hideDep      = globalPrefs.hideDep;
        scope.settings.hideTrailer  = globalPrefs.hideTrailer;
        // Per-vehicle preset — fall back to global lastPresetKey
        var pKey = vehiclePrefs.presetKey || globalPrefs.lastPresetKey || 'STREET';
        scope.settings.pIdx = scope.presetCycle.indexOf(pKey);
        if (scope.settings.pIdx < 0) scope.settings.pIdx = 0;
        // Custom PSI — per-vehicle if set, else global last used
        scope.settings.customWarnPsi = vehiclePrefs.customWarnPsi != null
          ? vehiclePrefs.customWarnPsi : (globalPrefs.lastCustomWarn || 26);
        scope.settings.customCritPsi = vehiclePrefs.customCritPsi != null
          ? vehiclePrefs.customCritPsi : (globalPrefs.lastCustomCrit || 18);
        PRESETS.CUSTOM.warnPsi = scope.settings.customWarnPsi;
        PRESETS.CUSTOM.critPsi = scope.settings.customCritPsi;
      }
      buildSettings();

      // ── Derived display labels (kept in sync with settings) ───────
      scope.unitLabel     = UNITS[UNIT_CYCLE[scope.settings.uIdx]].label;
      scope.tempUnitLabel = scope.settings.tempUnitKey === 'C' ? 'C°' : 'F°';
      scope.presetKey     = scope.presetCycle[scope.settings.pIdx];
      scope.presetLabel   = PRESETS[scope.presetKey].label;

      function syncDerivedLabels() {
        scope.unitLabel     = UNITS[UNIT_CYCLE[scope.settings.uIdx]].label;
        scope.tempUnitLabel = scope.settings.tempUnitKey === 'C' ? 'C°' : 'F°';
        scope.presetKey     = scope.presetCycle[scope.settings.pIdx];
        scope.presetLabel   = PRESETS[scope.presetKey].label;
      }

      // ── Preset helpers for settings HTML ─────────────────────────
      var PRESET_COLORS_MAP = {
        STREET:  { color: '#80cc80', border: 'rgba(100,200,100,0.4)' },
        OFFROAD: { color: '#c8a050', border: 'rgba(200,160,80,0.4)'  },
        DRAG:    { color: '#ff8080', border: 'rgba(255,100,100,0.4)' },
        HEAVY:   { color: '#80aaff', border: 'rgba(100,160,255,0.4)' },
        CUSTOM:  { color: '#c090ff', border: 'rgba(180,120,255,0.4)' },
      };
      scope.presetColor = function(p) {
        return (PRESET_COLORS_MAP[p] || {}).color || '#888';
      };
      scope.presetBorderColor = function(p) {
        return (PRESET_COLORS_MAP[p] || {}).border || 'rgba(255,255,255,0.06)';
      };
      scope.presetTooltip = function(p) {
        if (p === 'CUSTOM') return 'Set your own warn and crit thresholds below';
        var pr = PRESETS[p];
        return pr ? 'WARN ' + pr.warnPsi + ' PSI  ·  CRIT ' + pr.critPsi + ' PSI' : '';
      };
      scope.onCustomPresetChange = function() {
        PRESETS.CUSTOM.warnPsi = scope.settings.customWarnPsi;
        PRESETS.CUSTOM.critPsi = scope.settings.customCritPsi;
        vehiclePrefs.customWarnPsi = scope.settings.customWarnPsi;
        vehiclePrefs.customCritPsi = scope.settings.customCritPsi;
        globalPrefs.lastCustomWarn = scope.settings.customWarnPsi;
        globalPrefs.lastCustomCrit = scope.settings.customCritPsi;
        saveGlobal();
        saveVehicle();
        refreshDisplay();
      };

      // ── Dependency detection state ─────────────────────────────────
      scope.depInflator  = false;
      scope.depNodeDmg   = false;
      scope.depThermals  = false;

      // ── Toast ──────────────────────────────────────────────────────
      scope.showToast  = false;
      var toastTimer   = null;

      scope.dismissToast = function() {
        scope.showToast = false;
        if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
      };

      var TOAST_KEY = 'tgcg_tp_v2_seen';
      function maybeShowToast() {
        try {
          if (!localStorage.getItem(TOAST_KEY)) {
            scope.showToast = true;
            localStorage.setItem(TOAST_KEY, '1');
            toastTimer = setTimeout(function() {
              scope.$evalAsync(function() { scope.showToast = false; });
            }, 5000);
          }
        } catch(e) {}
      }

      // ── Settings popout — draggable fixed panel ───────────────────
      scope.settingsOpen  = false;
      scope.pillVisible   = true; // always show app container so pill is accessible
      scope.popoutStyle   = { top: '50%', left: '50%', transform: 'translateX(-50%) translateY(-50%)' };

      var POPOUT_POS_KEY   = 'tgcg_tp_popout_pos';
      var POPOUT_SCALE_KEY = 'tgcg_tp_popout_scale';
      scope.popoutScale = 1.0;

      function loadPopoutScale() {
        try {
          var s = localStorage.getItem(POPOUT_SCALE_KEY);
          if (s) scope.popoutScale = Math.min(3.0, Math.max(0.6, parseFloat(s)));
        } catch(e) {}
      }
      function savePopoutScale(s) {
        try { localStorage.setItem(POPOUT_SCALE_KEY, String(s)); } catch(e) {}
      }
      loadPopoutScale();

      scope.scaleUp = function() {
        scope.popoutScale = Math.min(3.0, Math.round((scope.popoutScale + 0.05) * 100) / 100);
        savePopoutScale(scope.popoutScale);
      };
      scope.scaleDown = function() {
        scope.popoutScale = Math.max(0.6, Math.round((scope.popoutScale - 0.05) * 100) / 100);
        savePopoutScale(scope.popoutScale);
      };

      function loadPopoutPos() {
        try {
          var raw = localStorage.getItem(POPOUT_POS_KEY);
          if (raw) {
            var p = JSON.parse(raw);
            scope.popoutStyle = { top: p.top, left: p.left, transform: 'none' };
          }
        } catch(e) {}
      }
      function savePopoutPos(top, left) {
        try { localStorage.setItem(POPOUT_POS_KEY, JSON.stringify({ top: top, left: left })); } catch(e) {}
      }

      loadPopoutPos();

      scope.toggleSettings = function() {
        scope.settingsOpen = !scope.settingsOpen;
      };
      scope.openSettings  = function() { scope.settingsOpen = true; };
      scope.closeSettings = function() { scope.settingsOpen = false; };

      // Drag logic
      scope.startDrag = function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
            e.target.tagName === 'SELECT' || e.target.tagName === 'SPAN') return;
        var startX = e.clientX;
        var startY = e.clientY;
        var el = document.querySelector('.tp-popout-inner');
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var startTop  = rect.top;
        var startLeft = rect.left;

        // Switch from transform-center to absolute coords
        scope.popoutStyle = { top: startTop + 'px', left: startLeft + 'px', transform: 'none' };
        scope.$evalAsync(function(){});

        function onMove(me) {
          var newTop  = startTop  + (me.clientY - startY);
          var newLeft = startLeft + (me.clientX - startX);
          // Clamp to viewport
          newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - 100));
          newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - 100));
          scope.$evalAsync(function() {
            scope.popoutStyle = { top: newTop + 'px', left: newLeft + 'px', transform: 'none' };
          });
        }
        function onUp(ue) {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          var finalEl = document.querySelector('.tp-popout-inner');
          if (finalEl) {
            var r = finalEl.getBoundingClientRect();
            savePopoutPos(r.top + 'px', r.left + 'px');
          }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      var GLOBAL_KEYS = ['uIdx','tempUnitKey','tpIdx','useNewUI','showTemp','showBrakeTemp',
                         'showWear','refreshRate','hideDep','hideTrailer'];

      scope.setSetting = function(key, val) {
        scope.settings[key] = val;
        if (GLOBAL_KEYS.indexOf(key) >= 0) {
          globalPrefs[key] = val;
          saveGlobal();
        }
        syncDerivedLabels();
        if (key === 'hideDep' || key === 'useNewUI') { updateVisibility(); }
        if (key === 'showTemp' || key === 'showBrakeTemp' || key === 'showWear') { refreshDisplay(); }
      };

      scope.setUnit = function(idx) {
        scope.settings.uIdx = idx;
        globalPrefs.uIdx = idx;
        syncDerivedLabels();
        refreshDisplay();
        saveGlobal();
      };

      scope.setTempUnit = function(key) {
        scope.settings.tempUnitKey = key;
        globalPrefs.tempUnitKey = key;
        syncDerivedLabels();
        refreshDisplay();
        saveGlobal();
      };

      scope.setPreset = function(idx) {
        scope.settings.pIdx = idx;
        var pKey = scope.presetCycle[idx];
        vehiclePrefs.presetKey = pKey;
        globalPrefs.lastPresetKey = pKey;
        PRESETS.CUSTOM.warnPsi = scope.settings.customWarnPsi;
        PRESETS.CUSTOM.critPsi = scope.settings.customCritPsi;
        syncDerivedLabels();
        refreshDisplay();
        saveGlobal();
        saveVehicle();
      };

      scope.setTrailerPreset = function(idx) {
        scope.settings.tpIdx = idx;
        globalPrefs.tpIdx = idx;
        refreshDisplay();
        saveGlobal();
      };

      scope.onRefreshRateChange = function() {
        globalPrefs.refreshRate = Number(scope.settings.refreshRate) || 1000;
        saveGlobal();
        restartPoll();
      };

      // Legacy cycle helpers (used by legacy UI buttons)
      scope.cycleUnit = function() {
        scope.setUnit((scope.settings.uIdx + 1) % UNIT_CYCLE.length);
      };
      scope.cycleTempUnit = function() {
        scope.setTempUnit(scope.settings.tempUnitKey === 'C' ? 'F' : 'C');
      };
      scope.cyclePreset = function() {
        scope.setPreset((scope.settings.pIdx + 1) % scope.presetCycle.length);
      };
      scope.cycleTrailerPreset = function() {
        scope.setTrailerPreset((scope.settings.tpIdx + 1) % scope.presetCycle.length);
      };

      // Legacy trailer preset label helpers (used by legacy UI button)
      scope.trailerPresetKey   = scope.presetCycle[scope.settings.tpIdx];
      scope.trailerPresetLabel = PRESETS[scope.trailerPresetKey].label;

      // Keep trailer labels in sync — patch setTrailerPreset
      var _origSetTrailerPreset = scope.setTrailerPreset;
      scope.setTrailerPreset = function(idx) {
        _origSetTrailerPreset(idx);
        scope.trailerPresetKey   = scope.presetCycle[scope.settings.tpIdx];
        scope.trailerPresetLabel = PRESETS[scope.trailerPresetKey].label;
      };

      // ── Preset tooltip + chip style helpers (used by settings HTML) ──
      scope.presetTooltip = function(p) {
        if (p === 'CUSTOM') return 'Set your own warn and crit thresholds below';
        var d = PRESETS[p];
        return 'WARN ' + d.warnPsi + ' PSI  \u00b7  CRIT ' + d.critPsi + ' PSI';
      };

      var PRESET_CHIP_COLORS = {
        STREET:  { border: 'rgba(100,200,100,0.4)', color: '#80cc80' },
        OFFROAD: { border: 'rgba(200,160,80,0.4)',  color: '#c8a050' },
        DRAG:    { border: 'rgba(255,100,100,0.4)', color: '#ff8080' },
        HEAVY:   { border: 'rgba(100,160,255,0.4)', color: '#80aaff' },
        CUSTOM:  { border: 'rgba(180,120,255,0.4)', color: '#c090ff' },
      };
      scope.presetChipStyle = function(p, isActive) {
        var c = PRESET_CHIP_COLORS[p] || {};
        return {
          'color':            isActive ? '#e0e0e0' : c.color,
          'background':       isActive ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.4)',
          'border':           '1px solid ' + (isActive ? 'rgba(255,255,255,0.18)' : c.border),
        };
      };
      scope.presetColor = function(p) {
        return (PRESET_CHIP_COLORS[p] || {}).color || '#888';
      };
      scope.presetBorderColor = function(p) {
        return (PRESET_CHIP_COLORS[p] || {}).border || 'rgba(255,255,255,0.06)';
      };

      // ── Prefs persistence ──────────────────────────────────────────
      var currentVehicleId = 'default';
      function vehicleKey(vid) { return 'tgcg_tp_vehicle_' + (vid || 'default'); }

      scope.savePrefs = function() { savePrefs(); };

      function saveGlobal() {
        try { localStorage.setItem(GLOBAL_KEY, JSON.stringify(globalPrefs)); } catch(e) {}
      }
      function saveVehicle() {
        try { localStorage.setItem(vehicleKey(currentVehicleId), JSON.stringify(vehiclePrefs)); } catch(e) {}
      }
      function savePrefs() { saveGlobal(); saveVehicle(); }

      function loadGlobal() {
        try {
          var raw = localStorage.getItem(GLOBAL_KEY);
          if (!raw) {
            // Migrate from old per-vehicle format if present
            var oldRaw = localStorage.getItem('tp_prefs_default');
            if (oldRaw) {
              var old = JSON.parse(oldRaw);
              if (old.uIdx  != null) globalPrefs.uIdx         = old.uIdx;
              if (old.tempUnitKey)   globalPrefs.tempUnitKey   = old.tempUnitKey;
              if (old.tpIdx != null) globalPrefs.tpIdx         = old.tpIdx;
              if (old.useNewUI != null) globalPrefs.useNewUI   = old.useNewUI;
              if (old.showTemp != null) globalPrefs.showTemp   = old.showTemp;
              if (old.showBrakeTemp != null) globalPrefs.showBrakeTemp = old.showBrakeTemp;
              if (old.showWear != null) globalPrefs.showWear   = old.showWear;
              if (old.refreshRate)   globalPrefs.refreshRate   = Number(old.refreshRate) || 1000;
              if (old.hideDep != null) globalPrefs.hideDep     = old.hideDep;
              if (old.hideTrailer != null) globalPrefs.hideTrailer = old.hideTrailer;
            }
            return;
          }
          var g = JSON.parse(raw);
          globalPrefs = angular.merge({}, GLOBAL_DEFAULTS, g);
          globalPrefs.refreshRate = Number(globalPrefs.refreshRate) || 1000;
          if (globalPrefs.tpIdx >= scope.trailerPresetCycle.length) globalPrefs.tpIdx = 0;
          if (globalPrefs.uIdx  >= UNIT_CYCLE.length) globalPrefs.uIdx = 0;
        } catch(e) {}
      }

      function loadVehicle(vid) {
        try {
          vehiclePrefs = angular.copy(VEHICLE_DEFAULTS);
          var raw = localStorage.getItem(vehicleKey(vid));
          if (!raw) {
            // No per-vehicle data — also check old format
            var oldRaw = localStorage.getItem('tp_prefs_' + vid);
            if (oldRaw) {
              var old = JSON.parse(oldRaw);
              var pk = scope.presetCycle[old.pIdx];
              if (pk) vehiclePrefs.presetKey = pk;
              if (old.customWarnPsi != null) vehiclePrefs.customWarnPsi = old.customWarnPsi;
              if (old.customCritPsi != null) vehiclePrefs.customCritPsi = old.customCritPsi;
            }
            return;
          }
          var v = JSON.parse(raw);
          if (v.presetKey && scope.presetCycle.indexOf(v.presetKey) >= 0) vehiclePrefs.presetKey = v.presetKey;
          if (v.customWarnPsi != null) vehiclePrefs.customWarnPsi = v.customWarnPsi;
          if (v.customCritPsi != null) vehiclePrefs.customCritPsi = v.customCritPsi;
        } catch(e) {}
      }

      // Initial load
      loadGlobal();

      // ── Hysteresis ─────────────────────────────────────────────────
      var HYSTERESIS_PSI = 1.5;
      var wheelStatus = {};

      function activePreset(isTrailer) {
        var key = isTrailer
          ? scope.presetCycle[scope.settings.tpIdx]
          : scope.presetCycle[scope.settings.pIdx];
        return PRESETS[key] || PRESETS.STREET;
      }

      function getStatus(pa, id, isTrailer) {
        var preset = activePreset(isTrailer);
        var psi    = pa * UNITS.PSI.fromPa;
        var cur    = wheelStatus[id] || 'ok';
        var next;
        if (cur === 'crit')      next = psi < preset.critPsi + HYSTERESIS_PSI ? 'crit' : psi < preset.warnPsi - HYSTERESIS_PSI ? 'warn' : 'ok';
        else if (cur === 'warn') next = psi < preset.critPsi - HYSTERESIS_PSI ? 'crit' : psi < preset.warnPsi + HYSTERESIS_PSI ? 'warn' : 'ok';
        else                     next = psi < preset.critPsi - HYSTERESIS_PSI ? 'crit' : psi < preset.warnPsi - HYSTERESIS_PSI ? 'warn' : 'ok';
        wheelStatus[id] = next;
        return next;
      }

      // ── State ──────────────────────────────────────────────────────
      var rawPa        = [];
      var rawTemp      = [];
      var rawBrakeTemp = [];
      var thermals     = {};
      var wCount       = 0;
      var axleGroups   = [];
      var metaRead     = false;
      var metaTimer    = null;
      var autoDetected = false;
      var trailerData  = {};
      var lastTrailerCount     = 0;
      var knownTrailerIds      = {};
      var focusedOnTrailer     = false;
      var focusedVehicleId     = null;
      var disabledTrailerIds   = {};
      var connectedTrailerIds  = {};
      var lastElectrics        = null;
      var trailerSuppressUntil = 0;

      scope.axles           = [];
      scope.trailerSections = [];
      scope.visible         = false;
      scope.mainCollapsed   = false;
      scope.trailerCollapsed = {};

      scope.toggleMain = function() { scope.mainCollapsed = !scope.mainCollapsed; };
      scope.toggleTrailerSection = function(id) { scope.trailerCollapsed[id] = !scope.trailerCollapsed[id]; };

      scope.manualRefresh = function() {
        wCount = 0; metaRead = false; autoDetected = false;
        rawPa = []; rawTemp = []; wheelStatus = {}; axleGroups = []; scope.axles = [];
        if (lastElectrics) { delete lastElectrics.tp_newcount; }
        detectWheels();
        setTimeout(function() { if (wCount === 0) detectWheels(); }, 500);
        setTimeout(function() { if (wCount === 0) detectWheels(); }, 1500);
      };

      // ── Visibility (dep filter + unicycle) ─────────────────────────
      var isUnicycle   = false;
      var rawVisible   = false; // true when vehicle electrics are live

      function updateVisibility() {
        if (!rawVisible)    { scope.visible = false; return; }
        if (isUnicycle)     { scope.visible = false; return; }
        if (scope.settings.hideDep && !scope.depInflator && !scope.depNodeDmg) {
          scope.visible = false; return;
        }
        scope.visible = true;
      }

      // ── Display ────────────────────────────────────────────────────
      function fmtVal(pa) {
        var u = UNITS[UNIT_CYCLE[scope.settings.uIdx]];
        var v = pa * u.fromPa;
        return u.dec > 0 ? v.toFixed(u.dec) : Math.round(v).toString();
      }

      function convertTemp(c) {
        return scope.settings.tempUnitKey === 'F' ? Math.round(c * 9/5 + 32) : Math.round(c);
      }

      function tempStatus(c) {
        if (c < 30)  return 'temp-cold';
        if (c < 80)  return 'temp-ok';
        if (c < 130) return 'temp-warm';
        return 'temp-hot';
      }

      function brakeStatus(c) {
        if (c < 80)  return 'brake-ok';
        if (c < 300) return 'brake-warm';
        if (c < 600) return 'brake-hot';
        return 'brake-crit';
      }

      function buildWheelObj(w, paSource, thermSource, isTrailer) {
        var paArr  = paSource   || rawPa;
        var thArr  = thermSource || thermals;
        var paRaw  = paArr[w.idx];
        var noData = (paRaw === -1);
        var pa     = (paRaw == null || noData) ? 0 : paRaw;
        var therm  = thArr[w.name] || thArr[w.idx] || null;
        var tempC     = (therm && therm.surfaceTemp != null) ? therm.surfaceTemp : (rawTemp[w.idx] != null ? rawTemp[w.idx] : null);
        var brakeC    = rawBrakeTemp[w.idx] != null ? rawBrakeTemp[w.idx] : null;
        var wearPct   = (therm && therm.wheelDam != null) ? Math.max(0, 100 - therm.wheelDam) : null;
        return {
          label:            w.name || (w.idx % 2 === 0 ? 'R' : 'L') + Math.floor(w.idx / 2),
          display:          noData ? 'N/A' : fmtVal(pa),
          status:           noData ? 'na'  : getStatus(pa, w.idx, !!isTrailer),
          isDualHub:        !!w.isDual,
          tempDisplay:      tempC  != null ? convertTemp(tempC)  + '°' : '--°',
          tempStatus:       tempC  != null ? tempStatus(tempC)  : 'temp-na',
          brakeDisplay:     brakeC != null ? convertTemp(brakeC) + '°' : '--°',
          brakeStatus:      brakeC != null ? brakeStatus(brakeC) : 'brake-na',
          hasWear:          wearPct !== null,
          wear:             wearPct !== null ? wearPct + '%' : '0%',
          wearColor:        wearPct !== null ? (wearPct > 70 ? '#4caf50' : wearPct > 40 ? '#ffeb3b' : '#f44336') : '#333',
        };
      }

      function updateCustomDisplay() { /* unit change already triggers fmtVal via refreshDisplay */ }

      function refreshDisplay() {
        scope.axles = axleGroups.map(function(axle) {
          return {
            label: axle.label,
            left:  axle.left.map(function(w)  { return buildWheelObj(w, rawPa, thermals, false); }),
            right: axle.right.map(function(w) { return buildWheelObj(w, rawPa, thermals, false); }),
          };
        }).filter(function(axle) {
          return axle.left.length > 0 && axle.right.length > 0;
        });

        scope.trailerSections = Object.keys(trailerData)
          .sort(function(a,b) { return (trailerData[a].order||0) - (trailerData[b].order||0); })
          .map(function(tid) {
            var td = trailerData[tid];
            if (!td.axleGroups || !td.axleGroups.length) return null;
            var axleRows = td.axleGroups.map(function(axle) {
              return {
                label: axle.label,
                left:  axle.left.map(function(w)  { return buildWheelObj(w, td.rawPa, {}, true); }),
                right: axle.right.map(function(w) { return buildWheelObj(w, td.rawPa, {}, true); }),
              };
            }).filter(function(axle) {
              var allNA = axle.left.concat(axle.right).every(function(w) { return w.status === 'na'; });
              return !allNA;
            });
            return { id: tid, axles: axleRows };
          }).filter(Boolean);
      }

      // ── Wheel name parsing ─────────────────────────────────────────
      function parseWheelName(name) {
        if (!name) return null;
        var axleOffset = 0;
        var parseName = name;
        var um = name.match(/^((?:[FRMfrm]_)+)(.+)$/i);
        if (um) {
          axleOffset = um[1].replace(/_/g, '').length * 100;
          parseName = um[2];
        } else {
          var rm = name.match(new RegExp('^(([FRMfrmlL])\\2+)(.+)$', 'i'));
          if (rm) {
            var candidateName = rm[2] + rm[3];
            var testRe = /^(\d*)([FRMfrm])(\d+|[^LRlrFRMfrm\d]?)([LRlr])([LRlr\d]?)$/i;
            if (testRe.test(candidateName)) {
              axleOffset = (rm[1].length - 1) * 100;
              parseName = candidateName;
            }
          }
        }
        var m = parseName.match(/^(\d*)([FRMfrmlL])(\d+|[^LRlrFRMfrmlL\d]?)([LRlr])([LRlr\d]?)$/i);
        if (m) {
          var typeChar = m[2].toUpperCase();
          var axleId   = m[3] || '';
          var sideChar = m[4].toUpperCase();
          var suffix   = m[5] || '';
          var leadNum  = m[1] || '';
          var axleNum  = 1;
          if (leadNum) {
            axleNum = parseInt(leadNum);
          } else if (/^\d+$/.test(axleId)) {
            var parsed = parseInt(axleId);
            axleNum = isNaN(parsed) ? 1 : parsed;
          } else if (axleId) {
            var c = axleId.toUpperCase().charCodeAt(0);
            axleNum = (axleId.toUpperCase() === 'O') ? 0 : c - 64;
          }
          var side    = sideChar === 'L' ? 'left' : 'right';
          var type    = typeChar === 'F' ? 'front' : typeChar === 'R' ? 'rear' : typeChar === 'L' ? 'lift' : 'mid';
          var isInner = (suffix.toUpperCase() === sideChar) || /^[2-9]$/.test(suffix);
          return { type: type, axleNum: axleNum + axleOffset, side: side, dualPos: isInner ? 'inner' : 'outer' };
        }
        return null;
      }

      function buildAxleGroups(wheelMeta) {
        if (wheelMeta.length % 2 !== 0) {
          wheelMeta = wheelMeta.slice(0, wheelMeta.length - 1);
        }
        var groups  = {};
        var unnamed = [];
        wheelMeta.forEach(function(w) {
          var p = parseWheelName(w.name);
          if (p) {
            var key = p.type + '_' + p.axleNum;
            if (!groups[key]) {
              var typeChar = p.type === 'front' ? 'F' : p.type === 'rear' ? 'R' : p.type === 'lift' ? 'La' : 'M';
              var lbl = typeChar + (p.axleNum === 0 ? 'O' : p.axleNum > 1 ? p.axleNum : '');
              groups[key] = { label: lbl, sortKey: 0, posYSum: 0, posYCount: 0, left: [], right: [] };
            }
            if (w.posY) { groups[key].posYSum += w.posY; groups[key].posYCount++; }
            var entry = { idx: w.idx, name: w.name, dualPos: p.dualPos };
            if (p.side === 'left') groups[key].left.push(entry);
            else                   groups[key].right.push(entry);
          } else {
            unnamed.push(w);
          }
        });
        var namedGroups = Object.values(groups);
        var frontSum = 0, frontN = 0, rearSum = 0, rearN = 0;
        namedGroups.forEach(function(g) {
          var isFront = /^F/i.test(g.label) && !/^La/i.test(g.label);
          var isRear  = /^R/i.test(g.label);
          var avg = g.posYCount > 0 ? g.posYSum / g.posYCount : null;
          if (avg !== null) {
            if (isFront) { frontSum += avg; frontN++; }
            if (isRear)  { rearSum  += avg; rearN++;  }
          }
        });
        var sortDesc = (frontN === 0 || rearN === 0) ? true :
                       (frontSum / frontN) > (rearSum / rearN);
        namedGroups.sort(function(a,b) {
          var ay = a.posYCount > 0 ? a.posYSum/a.posYCount : 0;
          var by = b.posYCount > 0 ? b.posYSum/b.posYCount : 0;
          return sortDesc ? (by - ay) : (ay - by);
        });
        namedGroups.forEach(function(g, i) { g.sortKey = i; });
        namedGroups.forEach(function(g) {
          g.left.sort(function(a,b)  { return (a.dualPos==='outer'?0:1)-(b.dualPos==='outer'?0:1); });
          g.right.sort(function(a,b) { return (a.dualPos==='inner'?0:1)-(b.dualPos==='inner'?0:1); });
        });
        if (unnamed.length > 0) {
          var leftWheels  = unnamed.filter(function(w) { return w.posX !== undefined ? w.posX <= 0 : w.offset <= 0; });
          var rightWheels = unnamed.filter(function(w) { return w.posX !== undefined ? w.posX >  0 : w.offset >  0; });
          leftWheels.sort(function(a,b)  { return b.posY - a.posY; });
          rightWheels.sort(function(a,b) { return b.posY - a.posY; });
          function groupByAxle(wheels) {
            if (!wheels.length) return [];
            var ag = [[wheels[0]]];
            for (var i = 1; i < wheels.length; i++) {
              var last = ag[ag.length - 1];
              var prevPosY = last[last.length - 1].posY;
              if (Math.abs(wheels[i].posY - prevPosY) < 0.3) { last.push(wheels[i]); }
              else { ag.push([wheels[i]]); }
            }
            return ag;
          }
          var leftGroups  = groupByAxle(leftWheels);
          var rightGroups = groupByAxle(rightWheels);
          var axleCount   = Math.max(leftGroups.length, rightGroups.length);
          var ai = Object.keys(groups).length;
          for (var axi = 0; axi < axleCount; axi++) {
            var lg = leftGroups[axi]  || [];
            var rg = rightGroups[axi] || [];
            lg.sort(function(a,b) { return a.offset - b.offset; });
            rg.sort(function(a,b) { return b.offset - a.offset; });
            var leftEntry  = lg.map(function(w) { return { idx:w.idx, name:w.name, isDual:w.isDual, dualPos: w.isDual ? 'inner' : 'outer' }; });
            var rightEntry = rg.map(function(w) { return { idx:w.idx, name:w.name, isDual:w.isDual, dualPos: w.isDual ? 'inner' : 'outer' }; });
            leftEntry.sort(function(a,b)  { return (a.dualPos==='outer'?0:1)-(b.dualPos==='outer'?0:1); });
            rightEntry.sort(function(a,b) { return (a.dualPos==='inner'?0:1)-(b.dualPos==='inner'?0:1); });
            var lbl = ai === 0 ? 'F' : 'R' + (ai > 1 ? ai : '');
            groups['unnamed_'+ai] = { label: lbl, sortKey: ai * 10, left: leftEntry, right: rightEntry };
            ai++;
          }
        }
        return Object.values(groups).sort(function(a,b) { return a.sortKey - b.sortKey; });
      }

      // ── Trailer polling ────────────────────────────────────────────
      var cachedTruckObjId  = 0;
      var lastTrainQueryTime = 0;

      function updateTruckId() {
        bngApi.activeObjectLua('electrics.values.tp_truckid=obj:getID()');
      }

      function pollTrailers() {
        var el = lastElectrics;
        if (!el) return;
        var now = Date.now();
        var shouldQueryTrain = (now - lastTrainQueryTime) >= 500;
        if (shouldQueryTrain) {
          lastTrainQueryTime = now;
          bngApi.engineLua(
            'pcall(function() ' +
            '  local pid=be:getPlayerVehicleID(0) ' +
            '  local truck=be:getObjectByID(pid) ' +
            '  if not truck then return end ' +
            '  local tp=truck:getPosition() ' +
            '  local tf=truck:getDirectionVector() ' +
            '  local train=core_trailerRespawn and core_trailerRespawn.getVehicleTrain(pid) ' +
            '  local tids={} ' +
            '  if train and tf then ' +
            '    for id,_ in pairs(train) do ' +
            '      if id~=pid then ' +
            '        local tr=be:getObjectByID(id) ' +
            '        if tr then ' +
            '          local rp=tr:getPosition() ' +
            '          if (rp-tp):dot(tf)<3 then tids[#tids+1]=id end ' +
            '        end ' +
            '      end ' +
            '    end ' +
            '  end ' +
            '  table.sort(tids,function(a,b) ' +
            '    local ra=be:getObjectByID(a):getPosition() ' +
            '    local rb=be:getObjectByID(b):getPosition() ' +
            '    return (ra-tp):dot(tf)>(rb-tp):dot(tf) ' +
            '  end) ' +
            '  local validTids={} ' +
            '  for ti,tid in ipairs(tids) do validTids[#validTids+1]=tid end ' +
            '  truck:queueLuaCommand("electrics.values.tp_trcount="..#validTids) ' +
            '  for ti,tid in ipairs(validTids) do ' +
            '    truck:queueLuaCommand("electrics.values.tp_trid"..ti.."="..tid) ' +
            '  end ' +
            '  for i=#validTids+1,4 do ' +
            '    truck:queueLuaCommand("electrics.values.tp_trfw"..i.."=-1") ' +
            '  end ' +
            'end)'
          );
        }
        var truckObjId = cachedTruckObjId || el.tp_truckid || 0;
        if (!truckObjId) return;
        var count = el.tp_trcount || 0;
        for (var ti = 1; ti <= count; ti++) {
          var trailerObjId = el['tp_trid' + ti];
          if (!trailerObjId) continue;
          var nc = el['tp_tnc' + ti] || 0;
          if (!nc) {
            queryTrailerWheelCount(trailerObjId, ti, truckObjId);
          } else {
            pollTrailerWheels(trailerObjId, ti, nc, truckObjId);
          }
          if (ti > 1) {
            var prevTrailerObjId = el['tp_trid' + (ti - 1)];
            if (prevTrailerObjId) bridgeTrailerFwState(prevTrailerObjId, ti, truckObjId);
          }
        }
      }

      function bridgeTrailerFwState(trailerObjId, ti, truckObjId) {
        bngApi.engineLua(
          'pcall(function() ' +
          'local tp_fw=be:getObjectByID(' + trailerObjId + ') ' +
          'if tp_fw then tp_fw:queueLuaCommand([[' +
            'local fw=electrics.values.fifthwheel_attachmentState ' +
            'local v=fw~=nil and fw or -1 ' +
            'obj:queueGameEngineLua(\'be:getObjectByID(' + truckObjId + '):queueLuaCommand(\\\"electrics.values.tp_trfw' + ti + '=\'..tostring(v)..\'\\\")\')' +
          ']]) end ' +
          'end)'
        );
      }

      function queryTrailerWheelCount(trailerObjId, ti, truckObjId) {
        bngApi.engineLua(
          'pcall(function() ' +
          'local tp_tr5=be:getObjectByID(' + trailerObjId + ') ' +
          'if tp_tr5 then tp_tr5:queueLuaCommand([[' +
            'local nc=0 while wheels.wheels[nc] do nc=nc+1 end ' +
            'obj:queueGameEngineLua(\'be:getObjectByID(' + truckObjId + '):queueLuaCommand(\\\"electrics.values.tp_tnc' + ti + '=\' .. nc .. \'\\\")\')' +
          ']]) end ' +
          'end)'
        );
      }

      function pollTrailerWheels(trailerObjId, ti, nc, truckObjId) {
        for (var wi = 0; wi < nc; wi++) {
          (function(wi_) {
            var key = 'tp_t' + ti + '_pa' + wi_;
            bngApi.engineLua(
              'pcall(function() ' +
              'local tp_tr4=be:getObjectByID(' + trailerObjId + ') ' +
              'if tp_tr4 then tp_tr4:queueLuaCommand([[' +
                'local w=wheels.wheels[' + wi_ + '] ' +
                'local pg=w and w.pressureGroupId ' +
                'local env=obj:getEnvPressure() ' +
                'local pa=-1 ' +
                'if pg then ' +
                  'local p=obj:getGroupPressure(pg) ' +
                  'local d=w and w.isTireDeflated ' +
                  'pa=d and 0 or math.max(0,p-env) ' +
                'end ' +
                'obj:queueGameEngineLua(\'be:getObjectByID(' + truckObjId + '):queueLuaCommand(\\\"electrics.values.' + key + '=\' .. pa .. \'\\\")\')' +
              ']]) end ' +
              'end)'
            );
          })(wi);
        }
      }

      function queryTrailerMetaID(trailerObjId, count, tid, truckObjId) {
        bngApi.engineLua(
          'pcall(function() ' +
          'local tp_tr2=be:getObjectByID(' + trailerObjId + ') ' +
          'if tp_tr2 then tp_tr2:queueLuaCommand([=[' +
            'local rn=v.data.refNodes and v.data.refNodes[0] ' +
            'local refY=rn and obj:getNodePosition(rn.ref).y or 0 ' +
            'local refX=rn and obj:getNodePosition(rn.ref).x or nil ' +
            'if not refX then ' +
              'local xmin,xmax=math.huge,-math.huge ' +
              'for i=0,' + (count-1) + ' do ' +
                'local w=wheels.wheels[i] ' +
                'local np=w and obj:getNodePosition(w.node1) ' +
                'if np then xmin=math.min(xmin,np.x) xmax=math.max(xmax,np.x) end ' +
              'end ' +
              'refX=(xmin~=math.huge) and (xmin+xmax)/2 or 0 ' +
            'end ' +
            'local cmd="electrics.values.tp_tmeta_' + tid + '=1 " ' +
            'for i=0,' + (count-1) + ' do ' +
              'local w=wheels.wheels[i] ' +
              'local np=w and obj:getNodePosition(w.node1) ' +
              'cmd=cmd.."electrics.values.tp_tmn1_' + tid + '_"..i.."="..(w and w.node1 or -1).." " ' +
              'cmd=cmd.."electrics.values.tp_tmn2_' + tid + '_"..i.."="..(w and w.node2 or -1).." " ' +
              'cmd=cmd.."electrics.values.tp_tmoff_' + tid + '_"..i.."="..(w and w.wheelOffset or 0).." " ' +
              'cmd=cmd.."electrics.values.tp_tmpos_' + tid + '_"..i.."="..(np and (np.y-refY) or 0).." " ' +
              'cmd=cmd.."electrics.values.tp_tmposx_' + tid + '_"..i.."="..(np and (np.x-refX) or 0).." " ' +
              'local vw2=v.data.wheels and v.data.wheels[i] ' +
              'local nm2=(vw2 and (vw2.name or "")) or "" ' +
              'local isd=(nm2:match("[LRlr][LRlr]$") or nm2:match("[LRlr][2-9]$")) and 1 or 0 ' +
              'cmd=cmd.."electrics.values.tp_tmisd_' + tid + '_"..i.."="..isd.." " ' +
            'end ' +
            'obj:queueGameEngineLua(\'be:getObjectByID(' + truckObjId + '):queueLuaCommand(\\\"\'..cmd..\'\\\")\')' +
            ']=]) end ' +
            'end)'
        );
      }

      function processTrailerElectrics(el) {
        if (focusedOnTrailer) return;
        if (Date.now() < trailerSuppressUntil) return;
        var truckObjId = cachedTruckObjId || el.tp_truckid || 0;
        var count = el.tp_trcount || 0;
        for (var ci = 2; ci <= count; ci++) {
          var fw = el['tp_trfw' + ci];
          if (fw == null) continue;
          var fwNum = Number(fw);
          var fwTid = String(el['tp_trid' + ci] || ci);
          if (fwNum === 1) {
            connectedTrailerIds[fwTid] = true;
            delete disabledTrailerIds[fwTid];
          } else if (fwNum === 0 && connectedTrailerIds[fwTid]) {
            disabledTrailerIds[fwTid] = true;
          }
        }
        for (var di = 2; di <= count; di++) {
          var diTid = String(el['tp_trid' + di] || di);
          if (disabledTrailerIds[diTid]) { count = di - 1; break; }
        }
        var countDropped = count < lastTrailerCount;
        lastTrailerCount = count;
        if (count === 0) {
          if (Object.keys(trailerData).length > 0) {
            Object.keys(trailerData).forEach(function(tid) {
              if (trailerData[tid] && trailerData[tid]._staleTimer) clearTimeout(trailerData[tid]._staleTimer);
            });
            trailerData = {};
            scope.$evalAsync(refreshDisplay);
          }
          return;
        }
        var changed = false;
        for (var ti = 1; ti <= count; ti++) {
          var objId = el['tp_trid' + ti];
          var tid   = String(objId || ti);
          var nc    = el['tp_tnc' + ti] || 0;
          if (!objId) continue;
          if (!trailerData[tid]) {
            knownTrailerIds[tid] = true;
            trailerData[tid] = { wCount: 0, rawPa: [], axleGroups: [], metaRead: false, order: ti };
            changed = true;
          }
          var td = trailerData[tid];
          if (!nc) {
            var detectedNc = 0;
            while (el['tp_t' + ti + '_pa' + detectedNc] != null) detectedNc++;
            nc = detectedNc;
          }
          if (nc && nc !== td.wCount) {
            td.wCount = nc;
            td.rawPa  = new Array(nc).fill(0);
            td.metaRead = false;
            if (truckObjId) queryTrailerMetaID(objId, nc, tid, truckObjId);
            var fbImmediate = [];
            for (var k = 0; k < nc; k++) {
              var axle = Math.floor(k / 2);
              fbImmediate.push({ idx:k, name:'', node1:axle*10, node2:axle*10+1, offset:(k%2===0?1:-1), posY:axle });
            }
            td.axleGroups = buildAxleGroups(fbImmediate);
            changed = true;
          }
          if (!nc) continue;
          for (var i = 0; i < nc; i++) {
            var pa = el['tp_t' + ti + '_pa' + i];
            if (pa != null && pa !== td.rawPa[i]) { td.rawPa[i] = pa; changed = true; }
          }
          if (!td.metaRead && el['tp_tmeta_' + tid] >= 1) {
            var wheelMeta = [];
            for (var j = 0; j < nc; j++) {
              wheelMeta.push({
                idx: j, name: '',
                isDual: (el['tp_tmisd_' + tid + '_' + j] === 1),
                node1:  el['tp_tmn1_'  + tid + '_' + j] || 0,
                node2:  el['tp_tmn2_'  + tid + '_' + j] || 0,
                offset: el['tp_tmoff_' + tid + '_' + j] || 0,
                posY:   el['tp_tmpos_' + tid + '_' + j] || 0,
                posX:   el['tp_tmposx_'+ tid + '_' + j] || 0,
              });
            }
            var newGroups   = buildAxleGroups(wheelMeta);
            var newTotal    = newGroups.reduce(function(s,a){return s+a.left.length+a.right.length;},0);
            var newMinSide  = newGroups.length > 0 ? Math.min.apply(null, newGroups.map(function(a){ return Math.min(a.left.length, a.right.length); })) : 0;
            var oldTotal    = td.axleGroups.reduce(function(s,a){return s+a.left.length+a.right.length;},0);
            var oldMinSide  = td.axleGroups.length > 0 ? Math.min.apply(null, td.axleGroups.map(function(a){ return Math.min(a.left.length, a.right.length); })) : 0;
            var newIsBetter = (newTotal >= td.wCount) && (newMinSide >= 1) && (newMinSide >= oldMinSide);
            if (newIsBetter) { td.axleGroups = newGroups; changed = true; }
            else if (oldTotal === 0 && newTotal > 0) { td.axleGroups = newGroups; changed = true; }
            td.metaRead = true;
          }
          if (!td.metaRead && !td.metaTimer) {
            td.metaTimer = setTimeout(function() {
              if (!td.metaRead && td.wCount > 0) {
                var fb = [];
                for (var k = 0; k < td.wCount; k++) {
                  var axle = Math.floor(k / 2);
                  fb.push({ idx:k, name:'', node1:axle*10, node2:axle*10+1, offset:(k%2===0?1:-1), posY:axle });
                }
                td.axleGroups = buildAxleGroups(fb);
                td.metaRead = true;
                scope.$evalAsync(refreshDisplay);
              }
            }, 1500);
          }
        }
        Object.keys(trailerData).forEach(function(tid) {
          var found = false;
          for (var ti = 1; ti <= count; ti++) { if (String(el['tp_trid' + ti]) === tid) { found = true; break; } }
          if (!found) {
            if (trailerData[tid] && !trailerData[tid]._staleTimer) {
              trailerData[tid]._staleTimer = setTimeout((function(t) {
                return function() {
                  if (trailerData[t]) { delete trailerData[t]; scope.$evalAsync(refreshDisplay); }
                };
              })(tid), countDropped ? 300 : 800);
            }
          } else {
            if (trailerData[tid] && trailerData[tid]._staleTimer) {
              clearTimeout(trailerData[tid]._staleTimer);
              trailerData[tid]._staleTimer = null;
            }
          }
        });
        if (changed) scope.$evalAsync(refreshDisplay);
      }

      // ── Lua helpers ────────────────────────────────────────────────
      function detectWheels() {
        bngApi.activeObjectLua('local n=0 while wheels.wheels[n] do n=n+1 end electrics.values.tp_newcount=n');
      }

      function probeDepAndName() {
        // Probe inflator controller and vehicle name
        // Wear detection is handled by tireThermalData stream (depThermals)
        bngApi.activeObjectLua(
          'local inf=controller.getControllersByType("rlsTirePressureControl") ' +
          'electrics.values.tp_hasinflator=(inf and inf[1]) and 1 or 0 ' +
          'local nm=tostring(v.data.information and v.data.information.name or "") ' +
          'electrics.values.tp_vidname=nm'
        );
      }

      function readWheelMeta(count) {
        var header = 'local rn=v.data.refNodes and v.data.refNodes[0] local refY=rn and obj:getNodePosition(rn.ref).y or 0 ';
        for (var i = 0; i < count; i += 2) {
          var lua = header;
          var end = Math.min(i + 2, count);
          for (var j = i; j < end; j++) {
            lua += 'local w=wheels.wheels['+j+'] local vw=v.data.wheels['+j+'] local np=w and obj:getNodePosition(w.node1) ';
            lua += 'electrics.values["tp_wname'+j+'"]=tostring((vw and vw.name) or (w and w.name) or "") ';
            lua += 'electrics.values["tp_wn1'+j+'"]=w and w.node1 or -1 ';
            lua += 'electrics.values["tp_wn2'+j+'"]=w and w.node2 or -1 ';
            lua += 'electrics.values["tp_woff'+j+'"]=w and w.wheelOffset or 0 ';
            lua += 'electrics.values["tp_wposy'+j+'"]=np and (np.y-refY) or 0 ';
          }
          if (end >= count) lua += 'electrics.values.tp_metamark=' + count;
          bngApi.activeObjectLua(lua);
        }
      }

      function setupElectrics(count) {
        var lua = 'local env=obj:getEnvPressure() ';
        for (var i = 0; i < count; i++) {
          lua += 'local w=wheels.wheels['+i+'] ';
          lua += 'local pg=w and w.pressureGroupId ';
          lua += 'local p=pg and obj:getGroupPressure(pg) or env ';
          lua += 'local d=w and w.isTireDeflated ';
          lua += 'electrics.values["tp_pa'+i+'"]=d and 0 or math.max(0,p-env) ';
          // Tire temp: prefer treadTemperature (more realistic), fall back to lastTemperature
          lua += 'electrics.values["tp_tc'+i+'"]=w and (w.treadTemperature or w.lastTemperature) or 25 ';
          lua += 'electrics.values["tp_bt'+i+'"]=w and w.brakeSurfaceTemperature or 25 ';
        }
        bngApi.activeObjectLua(lua);
      }

      function autoDetectPreset(count) {
        if (autoDetected) return;
        var lua = 'local heavy=false ';
        for (var i = 0; i < count; i++) {
          lua += 'local w=wheels.wheels['+i+'] ';
          lua += 'if w and w.startingPressure and w.startingPressure>550000 then heavy=true end ';
        }
        lua += 'electrics.values.tp_isheavy=heavy and 1 or 0';
        bngApi.activeObjectLua(lua);
      }

      // ── Streams ────────────────────────────────────────────────────
      var pollInterval = null;
      var pollStartTime = 0;
      var streamsList  = ['electrics', 'tireThermalData'];
      StreamsManager.add(streamsList);

      scope.$on('$destroy', function() {
        StreamsManager.remove(streamsList);
        stopPoll();
        if (toastTimer) clearTimeout(toastTimer);
      });

      function stopPoll() {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        if (metaTimer)    { clearTimeout(metaTimer);     metaTimer    = null; }
      }

      function restartPoll() {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
          beginPollLoop();
        }
      }

      function beginPollLoop() {
        var rate = Number(scope.settings.refreshRate) || 1000;
        pollInterval = setInterval(function() {
          var el = lastElectrics;
          detectWheels();
          probeDepAndName();
          if (!el) return;

          // Vehicle name / unicycle check
          if (el.tp_vidname !== undefined) {
            var vname = String(el.tp_vidname || '').toLowerCase();
            var wasUnicycle = isUnicycle;
            isUnicycle = vname.indexOf('unicycle') !== -1;
            if (wasUnicycle !== isUnicycle) scope.$evalAsync(updateVisibility);
          }

          // Dependency detection
          var hadInflator = scope.depInflator;
          var hadNodeDmg  = scope.depNodeDmg;
          if (el.tp_hasinflator != null) scope.depInflator = el.tp_hasinflator === 1;
          if (hadInflator !== scope.depInflator || hadNodeDmg !== scope.depNodeDmg) {
            scope.$evalAsync(updateVisibility);
          }

          // Vehicle ID for per-vehicle prefs
          if (el.tp_vidname && el.tp_vidname !== currentVehicleId) {
            currentVehicleId = el.tp_vidname;
            scope.$evalAsync(function() {
              loadVehicle(currentVehicleId);
              buildSettings();
              syncDerivedLabels();
              refreshDisplay();
            });
          }

          // Wheel detection
          var detected = el.tp_newcount;
          if (detected && detected !== wCount) {
            wCount = detected; rawPa = new Array(wCount).fill(0); rawTemp = new Array(wCount).fill(null); rawBrakeTemp = new Array(wCount).fill(25);
            wheelStatus = {}; axleGroups = []; metaRead = false; autoDetected = false;
            if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
            autoDetectPreset(wCount);
            readWheelMeta(wCount);
            metaTimer = setTimeout(function() {
              metaTimer = null;
              if (!metaRead && wCount > 0) {
                var fb = [];
                for (var i = 0; i < wCount; i++) fb.push({ idx:i, name:'', node1:i*2, node2:i*2+1, offset:(i%2===0?1:-1), posY:(i<wCount/2?1:0) });
                axleGroups = buildAxleGroups(fb); metaRead = true;
                scope.$evalAsync(refreshDisplay);
              }
            }, 2000);
          }

          // Wheel meta
          if (!metaRead && wCount > 0 && el.tp_metamark >= wCount) {
            var ok = true; var wheelMeta = [];
            for (var i = 0; i < wCount; i++) {
              if (el['tp_wname'+i] == null) { ok = false; break; }
              wheelMeta.push({ idx:i, name:String(el['tp_wname'+i]||''), node1:el['tp_wn1'+i], node2:el['tp_wn2'+i], offset:el['tp_woff'+i]||0, posY:el['tp_wposy'+i]||0 });
            }
            if (ok) {
              axleGroups = buildAxleGroups(wheelMeta); metaRead = true;
              if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
              scope.$evalAsync(refreshDisplay);
            }
          }

          // Heavy preset auto-detect
          if (!autoDetected && el.tp_isheavy != null) {
            autoDetected = true;
            if (el.tp_isheavy === 1) {
              scope.$evalAsync(function() { scope.setPreset(scope.presetCycle.indexOf('HEAVY')); });
            }
          }

          if (wCount > 0) { setupElectrics(wCount); }
          updateTruckId();
          pollTrailers();
        }, rate);
      }

      function startPoll() {
        if (pollInterval) return;
        pollStartTime = Date.now();
        rawVisible    = true;
        autoDetected  = false;
        metaRead      = false;
        wCount        = 0;
        rawPa         = [];
        rawTemp       = [];
        rawBrakeTemp  = [];
        wheelStatus   = {};
        axleGroups    = [];
        scope.axles   = [];
        StreamsManager.remove(streamsList);
        StreamsManager.add(streamsList);
        detectWheels();
        probeDepAndName();
        updateTruckId();
        updateVisibility();
        maybeShowToast();
        beginPollLoop();
      }

      scope.$on('streamsUpdate', function(event, data) {
        if (!data.electrics) return;
        lastElectrics = data.electrics;
        if (lastElectrics.tp_truckid) cachedTruckObjId = lastElectrics.tp_truckid;
        var isDef = lastElectrics.maxrpm        != undefined ||
                    lastElectrics.ignitionLevel != undefined ||
                    lastElectrics.wheelspeed    != undefined ||
                    lastElectrics.brake         != undefined ||
                    lastElectrics.throttle      != undefined;
        if (data.tireThermalData && data.tireThermalData.wheels) {
          var rawT = data.tireThermalData.wheels; thermals = {};
          var tKeys = Object.keys(rawT);
          if (tKeys.length > 0) {
            if (!scope.depThermals) scope.$evalAsync(function() { scope.depThermals = true; });
            for (var ti = 0; ti < tKeys.length; ti++) {
              var tKey = tKeys[ti];
              var tVal = rawT[tKey];
              // Key by stream key (may be numeric string like "0")
              thermals[tKey] = tVal;
              // Key by numeric value of stream key so thArr[w.idx] works
              var tKeyNum = Number(tKey);
              if (!isNaN(tKeyNum)) { thermals[tKeyNum] = tVal; }
              // Key by name field inside the therm object (e.g. "FL", "FR")
              if (tVal && tVal.name) { thermals[tVal.name] = tVal; }
              // Key by wheelIndex if present
              if (tVal && tVal.wheelIndex != null) { thermals[tVal.wheelIndex] = tVal; }
            }
          } else {
            thermals = {};
          }
        } else {
          thermals = {};
          if (scope.depThermals) scope.$evalAsync(function() { scope.depThermals = false; });
        }
        if (isDef && !pollInterval) { startPoll(); }
        else if (!isDef && pollInterval && (Date.now() - pollStartTime > 2000)) {
          stopPoll();
          rawVisible = false;
          updateVisibility();
          wCount = 0; axleGroups = []; scope.axles = [];
        }
        if (isDef) processTrailerElectrics(lastElectrics);
        if (isDef && wCount > 0) {
          var changed = false;
          for (var i = 0; i < wCount; i++) {
            var pa = lastElectrics['tp_pa'+i];
            if (pa != null && pa !== rawPa[i]) { rawPa[i] = pa; changed = true; }
            var tc = lastElectrics['tp_tc'+i];
            if (tc != null && tc !== rawTemp[i]) { rawTemp[i] = tc; changed = true; }
            var bt = lastElectrics['tp_bt'+i];
            if (bt != null && bt !== rawBrakeTemp[i]) { rawBrakeTemp[i] = bt; changed = true; }
          }
          if (changed || data.tireThermalData) scope.$evalAsync(refreshDisplay);
        }
      });

      // ── Reset handlers ─────────────────────────────────────────────
      function fullReset() {
        stopPoll();
        lastElectrics = null;
        wCount = 0; autoDetected = false; metaRead = false;
        rawPa = []; rawTemp = []; rawBrakeTemp = []; wheelStatus = {}; thermals = {}; axleGroups = [];
        lastTrailerCount = 0;
        focusedOnTrailer = false;
        focusedVehicleId = null;
        trailerSuppressUntil = 0;
        disabledTrailerIds = {};
        connectedTrailerIds = {};
        isUnicycle = false;
        rawVisible = false;
        scope.depThermals = false;
        scope.axles = [];
        updateVisibility();
      }

      function softReset(clearTrailers) {
        if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
        if (!metaRead) {
          wCount = 0; autoDetected = false;
          rawPa = []; rawTemp = []; rawBrakeTemp = []; wheelStatus = {}; axleGroups = []; scope.axles = [];
        }
        metaRead = false;
        lastTrailerCount = 0;
        if (clearTrailers) {
          Object.keys(trailerData).forEach(function(tid) {
            if (trailerData[tid] && trailerData[tid]._staleTimer) clearTimeout(trailerData[tid]._staleTimer);
          });
          trailerData = {};
          disabledTrailerIds = {};
          connectedTrailerIds = {};
          if (lastElectrics) {
            delete lastElectrics.tp_trcount;
            delete lastElectrics.tp_truckid;
            delete lastElectrics.tp_newcount;
          }
          cachedTruckObjId = 0;
          trailerSuppressUntil = Date.now() + 700;
          StreamsManager.remove(streamsList);
          StreamsManager.add(streamsList);
          scope.$evalAsync(refreshDisplay);
        }
      }

      scope.$on('VehicleChange',        function() { fullReset(); });
      scope.$on('VehicleReload',        function() { fullReset(); });
      scope.$on('VehicleObjectChanged', function() { softReset(false); });
      scope.$on('VehicleConfigChange',  function() { softReset(false); });
      scope.$on('VehicleReset',         function() { softReset(false); });
      scope.$on('VehicleFocusChanged',  function(event, data) {
        var newId = data && data.id ? String(data.id) : null;
        focusedVehicleId = newId;
        focusedOnTrailer = !!(newId && knownTrailerIds[newId]);
        if (focusedOnTrailer) {
          Object.keys(trailerData).forEach(function(tid) {
            if (trailerData[tid] && trailerData[tid]._staleTimer) clearTimeout(trailerData[tid]._staleTimer);
            delete trailerData[tid];
          });
          lastTrailerCount = 0;
          scope.$evalAsync(refreshDisplay);
        }
        if (!newId) { fullReset(); } else {
          softReset(true);
          var retryDetect = function() { detectWheels(); };
          setTimeout(function() { if (wCount === 0 && focusedVehicleId === newId) retryDetect(); }, 200);
          setTimeout(function() { if (wCount === 0 && focusedVehicleId === newId) retryDetect(); }, 500);
          setTimeout(function() { if (wCount === 0 && focusedVehicleId === newId) retryDetect(); }, 1000);
          setTimeout(function() { if (wCount === 0 && focusedVehicleId === newId) retryDetect(); }, 2000);
        }
      });

    }
  };
}]);
