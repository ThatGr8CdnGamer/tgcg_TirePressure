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
      var uIdx = 0;
      scope.unit = 'PSI';

      var TEMP_UNITS = { C: 'C°', F: 'F°' };
      var tempUnitKey = 'C';
      scope.tempUnit = 'C°';

      scope.cycleTempUnit = function() {
        tempUnitKey = tempUnitKey === 'C' ? 'F' : 'C';
        scope.tempUnit = TEMP_UNITS[tempUnitKey];
        refreshDisplay(); savePrefs();
      };

      function convertTemp(c) { return tempUnitKey === 'F' ? Math.round(c * 9/5 + 32) : Math.round(c); }
      function tempStatus(c) {
        if (c < 30)  return 'temp-cold';
        if (c < 80)  return 'temp-ok';
        if (c < 130) return 'temp-warm';
        return 'temp-hot';
      }

      // ── Presets ────────────────────────────────────────────────────
      var PRESETS = {
        STREET:  { label:'STREET',  warnPsi:26, critPsi:18 },
        OFFROAD: { label:'OFFROAD', warnPsi:15, critPsi:8  },
        DRAG:    { label:'DRAG',    warnPsi:38, critPsi:32 },
        HEAVY:   { label:'HEAVY',   warnPsi:85, critPsi:65 },
      };
      var PRESET_CYCLE = ['STREET','OFFROAD','DRAG','HEAVY'];
      var pIdx = 0;
      scope.presetKey   = 'STREET';
      scope.presetLabel = 'STREET';

      // Trailer has its own independent preset (defaults to STREET - most trailers spawn ~45 PSI)
      var tpIdx = PRESET_CYCLE.indexOf('STREET');
      scope.trailerPresetKey   = 'STREET';
      scope.trailerPresetLabel = 'STREET';
      scope.mainCollapsed = false;
      scope.toggleMain = function() { scope.mainCollapsed = !scope.mainCollapsed; };

      scope.manualRefresh = function() {
        // Full wheel redetection - useful when loaner vehicles don't auto-detect
        wCount = 0; metaRead = false; autoDetected = false;
        rawPa = []; rawTemp = []; wheelStatus = {}; axleGroups = []; scope.axles = [];
        if (lastElectrics) { delete lastElectrics.tp_newcount; }
        
        detectWheels();
        // Retry a couple times in case wheels aren't ready yet
        setTimeout(function() { if (wCount === 0) {  detectWheels(); } }, 500);
        setTimeout(function() { if (wCount === 0) {  detectWheels(); } }, 1500);
      };

      scope.trailerCollapsed = {}; // keyed by section id
      scope.toggleTrailerSection = function(id) {
        scope.trailerCollapsed[id] = !scope.trailerCollapsed[id];
      };

      scope.cycleTrailerPreset = function() {
        tpIdx = (tpIdx + 1) % PRESET_CYCLE.length;
        scope.trailerPresetKey   = PRESET_CYCLE[tpIdx];
        scope.trailerPresetLabel = PRESETS[scope.trailerPresetKey].label;
        refreshDisplay(); savePrefs();
      };

      var currentVehicleId = 'default';
      function storageKey(vid) { return 'tp_prefs_' + (vid || 'default'); }

      function savePrefs() {
        try {
          localStorage.setItem(storageKey(currentVehicleId), JSON.stringify({
            pIdx: pIdx, uIdx: uIdx, tempUnitKey: tempUnitKey, tpIdx: tpIdx,
          }));
        } catch(e) {}
      }

      function loadPrefs(vid) {
        try {
          var raw = localStorage.getItem(storageKey(vid));
          if (!raw) return;
          var p = JSON.parse(raw);
          if (p.pIdx != null && p.pIdx < PRESET_CYCLE.length) { pIdx = p.pIdx; scope.presetKey = PRESET_CYCLE[pIdx]; scope.presetLabel = PRESETS[scope.presetKey].label; }
          if (p.tpIdx != null && p.tpIdx < PRESET_CYCLE.length) { tpIdx = p.tpIdx; scope.trailerPresetKey = PRESET_CYCLE[tpIdx]; scope.trailerPresetLabel = PRESETS[scope.trailerPresetKey].label; }
          if (p.uIdx != null && p.uIdx < UNIT_CYCLE.length)   { uIdx = p.uIdx; scope.unit = UNITS[UNIT_CYCLE[uIdx]].label; }
          if (p.tempUnitKey) { tempUnitKey = p.tempUnitKey; scope.tempUnit = TEMP_UNITS[tempUnitKey]; }
        } catch(e) {}
      }

      scope.cycleUnit = function() {
        uIdx = (uIdx + 1) % UNIT_CYCLE.length;
        scope.unit = UNITS[UNIT_CYCLE[uIdx]].label;
        updateCustomDisplay(); refreshDisplay(); savePrefs();
      };
      scope.cyclePreset = function() {
        pIdx = (pIdx + 1) % PRESET_CYCLE.length;
        scope.presetKey = PRESET_CYCLE[pIdx]; scope.presetLabel = PRESETS[scope.presetKey].label;
        refreshDisplay(); savePrefs();
      };

      // ── Hysteresis ─────────────────────────────────────────────────
      var HYSTERESIS_PSI = 1.5;
      var wheelStatus = {};

      function getStatus(pa, id, presetOverride) {
        var preset = presetOverride || PRESETS[scope.presetKey];
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
      var rawTemp      = []; // per-wheel surface temp in °C, from Lua fallback
      var thermals     = {};
      var wCount       = 0;
      var axleGroups   = [];
      var metaRead     = false;
      var metaTimer    = null;
      var autoDetected = false;
      var trailerData  = {}; // keyed by trailer vehicle ID string
      var lastTrailerCount = 0;  // detect coupling/uncoupling immediately
      var knownTrailerIds = {}; // vehicle IDs seen as trailers - suppresses rebuild when focused on them
      var focusedOnTrailer = false; // true when focused on a known trailer vehicle
      var focusedVehicleId = null; // ID from VehicleFocusChanged - used to target correct vehicle in detectWheels
      var disabledTrailerIds = {}; // sticky: trailer IDs whose fw=0 (disconnected from chain)
      var connectedTrailerIds = {}; // trailer IDs that have confirmed fw=1 at least once
      var lastElectrics = null;
      var lastTrailerSectionCount = 0; // for RD change logging
      var trailerSuppressUntil = 0;   // epoch ms; processTrailerElectrics no-ops until this passes

      scope.axles            = [];
      scope.trailerSections  = [];
      scope.visible          = false;

      // ── Display ────────────────────────────────────────────────────
      function fmtVal(pa) {
        var u = UNITS[UNIT_CYCLE[uIdx]];
        var v = pa * u.fromPa;
        return u.dec > 0 ? v.toFixed(u.dec) : Math.round(v).toString();
      }

      function buildWheelObj(w, paSource, thermSource, presetOverride) {
        var paArr = paSource  || rawPa;
        var thArr = thermSource || thermals;
        var paRaw = paArr[w.idx];
        var noData = (paRaw === -1);          // sentinel: wheel exists but has no pressure group
        var pa    = (paRaw == null || noData) ? 0 : paRaw;
        var therm = thArr[w.name] || thArr[w.idx] || null;
        // Always show temp: use tireThermalData surfaceTemp if available, fall back to rawTemp
        var tempC = therm ? therm.surfaceTemp : (rawTemp[w.idx] != null ? rawTemp[w.idx] : null);
        var wearPct = therm ? Math.max(0, 100 - therm.wheelDam) : null;
        return {
          label:       w.name || (w.idx % 2 === 0 ? 'R' : 'L') + Math.floor(w.idx / 2),
          display:     noData ? 'N/A' : fmtVal(pa),
          status:      noData ? 'na'  : getStatus(pa, w.idx, presetOverride),
          isDualHub:   !!w.isDual,
          tempDisplay: tempC != null ? convertTemp(tempC) + '°' : '--°',
          tempStatus:  tempC != null ? tempStatus(tempC) : 'temp-na',
          hasWear:     wearPct !== null,
          wear:        wearPct !== null ? wearPct + '%' : '0%',
          wearColor:   wearPct !== null ? (wearPct > 70 ? '#4caf50' : wearPct > 40 ? '#ffeb3b' : '#f44336') : '#333',
        };
      }

      function refreshDisplay() {
        scope.axles = axleGroups.map(function(axle) {
          return {
            label: axle.label,
            left:  axle.left.map(function(w)  { return buildWheelObj(w, rawPa, thermals); }),
            right: axle.right.map(function(w) { return buildWheelObj(w, rawPa, thermals); }),
          };
        }).filter(function(axle) {
          // Drop axles missing wheels on one side entirely (spare mounts, aux wheels, etc.)
          return axle.left.length > 0 && axle.right.length > 0;
        });

        // Trailer sections sorted by order
        scope.trailerSections = Object.keys(trailerData)
          .sort(function(a,b) { return (trailerData[a].order||0) - (trailerData[b].order||0); })
          .map(function(tid) {
            var td = trailerData[tid];
            if (!td.axleGroups || !td.axleGroups.length) return null;
            var axleRows = td.axleGroups.map(function(axle) {
              return {
                label: axle.label,
                left:  axle.left.map(function(w)  { return buildWheelObj(w, td.rawPa, {}, PRESETS[scope.trailerPresetKey]); }),
                right: axle.right.map(function(w) { return buildWheelObj(w, td.rawPa, {}, PRESETS[scope.trailerPresetKey]); }),
              };
            }).filter(function(axle) {
              // Drop axles where every tile is N/A - these are non-tire wheels (spare/dolly/coupler)
              var allNA = axle.left.concat(axle.right).every(function(w) { return w.status === 'na'; });
              return !allNA;
            });
            return { id: tid, axles: axleRows };
          }).filter(Boolean);
        // Diagnostic: log whenever trailer section count changes, including axle/wheel counts
        var _tsc = scope.trailerSections.length;
        if (_tsc !== lastTrailerSectionCount) {
          var _tdkeys = Object.keys(trailerData);
          var _axleInfo = scope.trailerSections.map(function(s) {
            return s.id+":axles="+s.axles.length+"("+s.axles.map(function(a){return "L"+a.left.length+"R"+a.right.length;}).join(",")+")";
          });
          console.log("RD: trailerSections "+lastTrailerSectionCount+"->"+_tsc+" td="+JSON.stringify(_tdkeys)+" "+_axleInfo.join(" "));
          lastTrailerSectionCount = _tsc;
        }

      }

      // ── Wheel name parsing ─────────────────────────────────────────
      function parseWheelName(name) {
        if (!name) return null;
        // Pre-process axle prefix conventions to an axleOffset + simplified name:
        //
        // 1. Underscore prefix: R_RL1, F_FL, R_R_RL1
        //    Each [Type]_ adds 100. R_RL1 → axleOffset=100, parseName='RL1'
        //
        // 2. Repeated type-char prefix WITHOUT underscore: FFR, FFL, RRL, RRR
        //    e.g. FFR (front-front-right), RRL (rear-rear-left)
        //    Strip all but one leading repeated char. FF→F+100, FFF→F+200, RR→R+100
        //    FFR → axleOffset=100, parseName='FR'
        //    RRL → axleOffset=100, parseName='RL' (correctly makes it left side)
        //    RRR → axleOffset=100, parseName='RR' (second rear axle right outer)
        var axleOffset = 0;
        var parseName = name;
        var um = name.match(/^((?:[FRMfrm]_)+)(.+)$/i);
        if (um) {
          axleOffset = um[1].replace(/_/g, '').length * 100;
          parseName = um[2];
        } else {
          // Repeated char prefix: ^(X)(X+)(rest) where X is a type char and rest is non-empty
          // e.g. FFR→front_101/right, RRL→rear_101/left
          // BUT only apply if the simplified name matches the main regex - otherwise
          // "RR1" is rear+right+dual1, not a repeated-R prefix producing "R1" with no side char.
          var rm = name.match(new RegExp('^(([FRMfrmlL])\\2+)(.+)$', 'i'));
          if (rm) {
            var candidateName = rm[2] + rm[3];
            var testRe = /^(\d*)([FRMfrm])(\d+|[^LRlrFRMfrm\d]?)([LRlr])([LRlr\d]?)$/i;
            if (testRe.test(candidateName)) {
              axleOffset = (rm[1].length - 1) * 100;
              parseName = candidateName;
            }
            // else: fall through, parse original name directly (e.g. RR1 = rear right inner-dual-1)
          }
        }
        // Handles multiple BeamNG naming conventions:
        // 1. FL, FR, RL, RR                          (simple: no axle num)
        // 2. R1L, R1LL, R2R, R2RR                    (digit axle num + dual suffix)
        // 3. RL2, RR2                                 (digit as dual suffix)
        // 4. ROL, ROLL, ROR, RORR                     (letter axle id e.g. O=outer/0)
        // 5. 1FL, 2RL etc.                            (leading digit axle num)
        // axle_id: digits (R1L, R2LL) OR single non-LR letter (ROL, ROLL) - not greedy into side char
        var m = parseName.match(/^(\d*)([FRMfrmlL])(\d+|[^LRlrFRMfrmlL\d]?)([LRlr])([LRlr\d]?)$/i);
        if (m) {
          var typeChar   = m[2].toUpperCase();
          var axleId     = m[3] || '';           // may be '', '1', '2', 'O', 'I' etc.
          var sideChar   = m[4].toUpperCase();
          var suffix     = m[5] || '';
          var leadNum    = m[1] || '';

          // Derive numeric axle number for sorting:
          // leading digit > trailing digit in axleId > letter mapped (O/0=0, I=1, others by char)
          var axleNum = 1;
          if (leadNum) {
            axleNum = parseInt(leadNum);
          } else if (/^\d+$/.test(axleId)) {
            var parsed = parseInt(axleId);
            axleNum = isNaN(parsed) ? 1 : parsed; // 0 is valid!
          } else if (axleId) {
            // Map letter axle IDs: O -> 0 -> sort as 1, F/A/B/C... alphabetically
            var c = axleId.toUpperCase().charCodeAt(0);
            axleNum = (axleId.toUpperCase() === 'O') ? 0 : c - 64; // A=1, B=2...
          }

          var side = sideChar === 'L' ? 'left' : 'right';
          var type = typeChar === 'F' ? 'front' : typeChar === 'R' ? 'rear' : typeChar === 'L' ? 'lift' : 'mid';
          // Inner dual: doubled side letter (RLL, ROLL) OR trailing digit >= 2 (RL2)
          var isInner = (suffix.toUpperCase() === sideChar) || /^[2-9]$/.test(suffix);
          return { type: type, axleNum: axleNum + axleOffset, side: side, dualPos: isInner ? 'inner' : 'outer' };
        }
        return null;
      }

      function buildAxleGroups(wheelMeta) {
        // Filter spare tire: if odd count, drop the last wheel
        if (wheelMeta.length % 2 !== 0) {
          console.log('TPRES: odd wheel count (' + wheelMeta.length + '), dropping last wheel as spare');
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
            // Accumulate posY to compute average for physical sort order
            if (w.posY) { groups[key].posYSum += w.posY; groups[key].posYCount++; }
            var entry = { idx: w.idx, name: w.name, dualPos: p.dualPos };
            if (p.side === 'left') groups[key].left.push(entry);
            else                   groups[key].right.push(entry);
          } else {
            unnamed.push(w);
          }
        });
        // Compute average posY per group, then determine sort direction from known front/rear types.
        // In BeamNG the ref node Y direction varies by vehicle, so we can't assume ascending/descending.
        // Strategy: find avg posY of 'front' named groups vs 'rear' named groups.
        //   If frontAvgY > rearAvgY → sort descending (front has highest Y)
        //   If frontAvgY < rearAvgY → sort ascending  (front has lowest Y)
        //   If neither exists → fall back to descending
        var namedGroups = Object.values(groups);
        var frontSum = 0, frontN = 0, rearSum = 0, rearN = 0;
        namedGroups.forEach(function(g) {
          // Identify type from label: starts with F=front, R=rear, La=lift, M=mid
          var isFront = /^F/i.test(g.label) && !/^La/i.test(g.label);
          var isRear  = /^R/i.test(g.label);
          var avg = g.posYCount > 0 ? g.posYSum / g.posYCount : null;
          if (avg !== null) {
            if (isFront) { frontSum += avg; frontN++; }
            if (isRear)  { rearSum  += avg; rearN++;  }
          }
        });
        // frontAvgY > rearAvgY means descending sort puts front first; otherwise ascending
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
          // Split left/right by offset sign (negative=left, positive=right - geometrically unambiguous).
          // Then group each side by posY proximity: dual pairs (FL+FL2) share the same posY,
          // different axles have a meaningful posY gap. Pair left_group[i] with right_group[i].
          // posX is vehicle-local X position from node1: negative = left side, positive = right.
          // This is more reliable than wheelOffset which varies by jbeam convention.
          // Fall back to offset sign if posX is 0 (pre-metadata fallback wheels have no posX).
          var leftWheels  = unnamed.filter(function(w) { return w.posX !== undefined ? w.posX <= 0 : w.offset <= 0; });
          var rightWheels = unnamed.filter(function(w) { return w.posX !== undefined ? w.posX >  0 : w.offset >  0; });
          leftWheels.sort(function(a,b)  { return b.posY - a.posY; });
          rightWheels.sort(function(a,b) { return b.posY - a.posY; });

          function groupByAxle(wheels) {
            if (!wheels.length) return [];
            var axleGroups = [[wheels[0]]];
            for (var i = 1; i < wheels.length; i++) {
              var last = axleGroups[axleGroups.length - 1];
              var prevPosY = last[last.length - 1].posY;
              // Wheels within 0.3m posY are on the same axle (groups dual inner/outer pairs).
              // Tandem axle separation is always >1m, well above this threshold.
              if (Math.abs(wheels[i].posY - prevPosY) < 0.3) {
                last.push(wheels[i]);
              } else {
                axleGroups.push([wheels[i]]);
              }
            }
            return axleGroups;
          }

          var leftGroups  = groupByAxle(leftWheels);
          var rightGroups = groupByAxle(rightWheels);
          var axleCount   = Math.max(leftGroups.length, rightGroups.length);
          var ai = Object.keys(groups).length;

          for (var axi = 0; axi < axleCount; axi++) {
            var lg = leftGroups[axi]  || [];
            var rg = rightGroups[axi] || [];
            // Sort within each group: outer (more negative/positive offset) first
            lg.sort(function(a,b) { return a.offset - b.offset; }); // most negative first = outer
            rg.sort(function(a,b) { return b.offset - a.offset; }); // most positive first = outer
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
      // Bridge: engineLua -> trailer:queueLuaCommand -> obj:queueGameEngineLua -> truck:queueLuaCommand -> truck electrics
      var cachedTruckObjId = 0;
      var lastTrainQueryTime = 0; // throttle getVehicleTrain calls to ~2/sec

      function updateTruckId() {
        // engineLua can't return values from assignments
        // Use activeObjectLua to get the truck's own ID from vehicle context
        bngApi.activeObjectLua('electrics.values.tp_truckid=obj:getID()');
      }

      function pollTrailers() {
        var el = lastElectrics;
        if (!el) return;

        // Hitch-agnostic train detection: fifthwheel_attachmentState only exists on 5th-wheel
        // trucks. Pickup trucks, goosenecks, and bumper-pull hitches don't write it.
        // Instead, always query getVehicleTrain from GE — it works for every hitch type.
        // Throttle to ~2 calls/sec (poll loop runs at 200ms) to avoid spamming engineLua.
        var now = Date.now();
        var shouldQueryTrain = (now - lastTrainQueryTime) >= 500;

        if (shouldQueryTrain) {
          lastTrainQueryTime = now;
          // Use getVehicleTrain to discover trailer IDs — works for all hitch types
          // (fifth wheel, gooseneck, bumper pull, etc.). Direction check filters
          // anything ahead of the truck so player-in-trailer focus doesn't flip ordering.
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
            '          if (rp-tp):dot(tf)<3 then ' +
            '            tids[#tids+1]=id ' +
            '          end ' +
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
            '  for ti,tid in ipairs(tids) do ' +
            '    validTids[#validTids+1]=tid ' +
            '  end ' +
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

        // Step 2: for each known trailer, poll wheels using the stored truck ID.
        // Runs every poll tick (200ms) regardless of train query throttle.
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
          // Bridge the PREVIOUS trailer's fifthwheel state for chain validation
          if (ti > 1) {
            var prevTrailerObjId = el['tp_trid' + (ti - 1)];
            if (prevTrailerObjId) bridgeTrailerFwState(prevTrailerObjId, ti, truckObjId);
          }
        }
      }

      function bridgeTrailerFwState(trailerObjId, ti, truckObjId) {
        bngApi.engineLua(
          "pcall(function() " +
          "local tp_fw=be:getObjectByID(" + trailerObjId + ") " +
          "if tp_fw then tp_fw:queueLuaCommand([[" +
            "local fw=electrics.values.fifthwheel_attachmentState " +
            "local v=fw~=nil and fw or -1 " +
            "obj:queueGameEngineLua('be:getObjectByID(" + truckObjId + "):queueLuaCommand(\"electrics.values.tp_trfw" + ti + "='..tostring(v)..'\")')" +
          "]]) end " +
          "end)"
        );
      }

      function queryTrailerWheelCount(trailerObjId, ti, truckObjId) {
        // Trailer Lua: nc concat'd into GE string at trailer-context eval time
        // Single-quoted Lua strings avoid " escaping; ' .. var .. ' embeds value
        bngApi.engineLua(
          "pcall(function() " +
          "local tp_tr5=be:getObjectByID(" + trailerObjId + ") " +
          "if tp_tr5 then tp_tr5:queueLuaCommand([[" +
            "local nc=0 while wheels.wheels[nc] do nc=nc+1 end " +
            "obj:queueGameEngineLua('be:getObjectByID(" + truckObjId + "):queueLuaCommand(\"electrics.values.tp_tnc" + ti + "=' .. nc .. '\")')" +
          "]]) end " +
          "end)"
        );
      }

      function pollTrailerWheels(trailerObjId, ti, nc, truckObjId) {
        for (var wi = 0; wi < nc; wi++) {
          (function(wi_) {
            var key = "tp_t" + ti + "_pa" + wi_;
            bngApi.engineLua(
              "pcall(function() " +
              "local tp_tr4=be:getObjectByID(" + trailerObjId + ") " +
              "if tp_tr4 then tp_tr4:queueLuaCommand([[" +
                "local w=wheels.wheels[" + wi_ + "] " +
                "local pg=w and w.pressureGroupId " +
                "local env=obj:getEnvPressure() " +
                "local pa=-1 " +
                "if pg then " +
                  "local p=obj:getGroupPressure(pg) " +
                  "local d=w and w.isTireDeflated " +
                  "pa=d and 0 or math.max(0,p-env) " +
                "end " +
                "obj:queueGameEngineLua('be:getObjectByID(" + truckObjId + "):queueLuaCommand(\"electrics.values." + key + "=' .. pa .. '\")')" +
              "]]) end " +
              "end)"
            );
          })(wi);
        }
      }

      function queryTrailerMetaID(trailerObjId, count, tid, truckObjId) {
        bngApi.engineLua(
          "pcall(function() " +
          "local tp_tr2=be:getObjectByID(" + trailerObjId + ") " +
          "if tp_tr2 then tp_tr2:queueLuaCommand([=[" +
            "local rn=v.data.refNodes and v.data.refNodes[0] " +
            "local refY=rn and obj:getNodePosition(rn.ref).y or 0 " +
            "local refX=rn and obj:getNodePosition(rn.ref).x or nil " +
            // If no refNode, compute midpoint of all wheel X positions as center reference
            "if not refX then " +
              "local xmin,xmax=math.huge,-math.huge " +
              "for i=0," + (count-1) + " do " +
                "local w=wheels.wheels[i] " +
                "local np=w and obj:getNodePosition(w.node1) " +
                "if np then xmin=math.min(xmin,np.x) xmax=math.max(xmax,np.x) end " +
              "end " +
              "refX=(xmin~=math.huge) and (xmin+xmax)/2 or 0 " +
            "end " +
            "local cmd='electrics.values.tp_tmeta_" + tid + "=1 ' " +
            "for i=0," + (count-1) + " do " +
              "local w=wheels.wheels[i] " +
              "local np=w and obj:getNodePosition(w.node1) " +
              "cmd=cmd..'electrics.values.tp_tmn1_" + tid + "_'..i..'='..(w and w.node1 or -1)..' ' " +
              "cmd=cmd..'electrics.values.tp_tmn2_" + tid + "_'..i..'='..(w and w.node2 or -1)..' ' " +
              "cmd=cmd..'electrics.values.tp_tmoff_" + tid + "_'..i..'='..(w and w.wheelOffset or 0)..' ' " +
              "cmd=cmd..'electrics.values.tp_tmpos_" + tid + "_'..i..'='..(np and (np.y-refY) or 0)..' ' " +
              "cmd=cmd..'electrics.values.tp_tmposx_" + tid + "_'..i..'='..(np and (np.x-refX) or 0)..' ' " +
              "local vw2=v.data.wheels and v.data.wheels[i] " +
              "local nm2=(vw2 and (vw2.name or '')) or '' " +
              "local isd=(nm2:match('[LRlr][LRlr]$') or nm2:match('[LRlr][2-9]$')) and 1 or 0 " +
              "cmd=cmd..'electrics.values.tp_tmisd_" + tid + "_'..i..'='..isd..' ' " +
            "end " +
            "obj:queueGameEngineLua('be:getObjectByID(" + truckObjId + "):queueLuaCommand(\"' .. cmd .. '\")')" +
            "]=]) end " +
            "end)"
         );
      }




      function processTrailerElectrics(el) {
        if (focusedOnTrailer) return; // focused on a trailer vehicle - suppress false train readings
        if (Date.now() < trailerSuppressUntil) return; // suppressed after trailer clear - wait for fresh bridge data
        var truckObjId = cachedTruckObjId || el.tp_truckid || 0;
        var count = el.tp_trcount || 0;
        // Chain validation using bridged fw states (tp_trfw{ti} written by bridgeTrailerFwState).
        // fw=0 → trailer disconnected from chain → add to sticky disabledTrailerIds set.
        // fw=1 → reconnected → remove from set. fw=-1 or null → no fw, ignore.
        for (var ci = 2; ci <= count; ci++) {
          var fw = el['tp_trfw' + ci];
          if (fw == null) continue;
          var fwNum = Number(fw);
          var fwTid = String(el['tp_trid' + ci] || ci);
          console.log('FW CHAIN ci='+ci+' tid='+fwTid+' fw='+fwNum+' conn='+!!connectedTrailerIds[fwTid]+' dis='+!!disabledTrailerIds[fwTid]);
          if (fwNum === 1) {
            connectedTrailerIds[fwTid] = true;
            delete disabledTrailerIds[fwTid];
          } else if (fwNum === 0 && connectedTrailerIds[fwTid]) {
            disabledTrailerIds[fwTid] = true;
          }
        }
        // Truncate count at first disabled trailer
        for (var di = 2; di <= count; di++) {
          var diTid = String(el['tp_trid' + di] || di);
          if (disabledTrailerIds[diTid]) { count = di - 1; break; }
        }
        // Detect coupling/uncoupling: if count dropped, fast-clear missing trailers
        var countDropped = count < lastTrailerCount;
        lastTrailerCount = count;

        if (count === 0) {
          // Immediately wipe all trailers — no timer needed, count is definitively 0
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
            knownTrailerIds[tid] = true; // remember this ID is a trailer
            trailerData[tid] = { wCount: 0, rawPa: [], axleGroups: [], metaRead: false, order: ti };
            changed = true;
          }
          var td = trailerData[tid];
          // Count wheels by scanning tp_t{ti}_pa{wi} keys if tp_tnc hasn't arrived
          if (!nc) {
            var detectedNc = 0;
            while (el['tp_t' + ti + '_pa' + detectedNc] != null) detectedNc++;
            nc = detectedNc;
          }
          // Update wheel count when it arrives - only grow, never shrink (guards against 0 blips)
          if (nc && nc !== td.wCount) {
            td.wCount = nc;
            td.rawPa  = new Array(nc).fill(0);
            td.metaRead = false;
            if (truckObjId) queryTrailerMetaID(objId, nc, tid, truckObjId);
            // Immediately build positional axle groups so wheels show right away
            var fbImmediate = [];
            for (var k = 0; k < nc; k++) {
              var axle = Math.floor(k / 2);
              fbImmediate.push({ idx:k, name:'', node1:axle*10, node2:axle*10+1, offset:(k%2===0?1:-1), posY:axle });
            }
            td.axleGroups = buildAxleGroups(fbImmediate);
            console.log("TD BUILD tid="+tid+" nc="+nc);
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
                node1: el['tp_tmn1_' + tid + '_' + j] || 0,
                node2: el['tp_tmn2_' + tid + '_' + j] || 0,
                offset: el['tp_tmoff_' + tid + '_' + j] || 0,
                posY:   el['tp_tmpos_' + tid + '_' + j] || 0,
                posX:   el['tp_tmposx_' + tid + '_' + j] || 0,
              });
            }
            console.log("TRAILER META tid="+tid+" nc="+nc+" wheels="+wheelMeta.map(function(w){return "w"+w.idx+"(posX="+w.posX+",posY="+w.posY.toFixed(2)+",off="+w.offset.toFixed(2)+",isDual="+w.isDual+")";}).join(" "));
            var newGroups = buildAxleGroups(wheelMeta);
            console.log("TRAILER GROUPS: "+newGroups.length+" "+newGroups.map(function(g){return g.label+"(L"+g.left.length+"R"+g.right.length+")";}).join(" "));
            var newTotal = newGroups.reduce(function(s,a){return s+a.left.length+a.right.length;},0);
            var newMinSide = newGroups.length > 0 ? Math.min.apply(null, newGroups.map(function(a){
              return Math.min(a.left.length, a.right.length);
            })) : 0;
            var oldTotal = td.axleGroups.reduce(function(s,a){return s+a.left.length+a.right.length;},0);
            var oldMinSide = td.axleGroups.length > 0 ? Math.min.apply(null, td.axleGroups.map(function(a){
              return Math.min(a.left.length, a.right.length);
            })) : 0;
            // Adopt new groups only if they are at least as balanced as what we have.
            // A result with any L0 or R0 axle is worse than an L1R1 layout.
            var newIsBetter = (newTotal >= td.wCount) && (newMinSide >= 1) &&
                              (newMinSide >= oldMinSide);
            if (newIsBetter) {
              td.axleGroups = newGroups;
              changed = true;
            } else if (oldTotal === 0 && newTotal > 0) {
              // Nothing was there before - take whatever we have
              td.axleGroups = newGroups;
              changed = true;
            }
            td.metaRead = true;
          }
          // Fallback: if we have pressure data but no metadata after a while, use positional grouping
          if (!td.metaRead && !td.metaTimer) {
            td.metaTimer = setTimeout(function() {
              if (!td.metaRead && td.wCount > 0) {
                var fb = [];
                // Group wheels into axle pairs: even=left, odd=right, posY spreads axles
                var axleCount = Math.ceil(td.wCount / 2);
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
        // Clean up trailers no longer in the train.
        // Timeout-based: start a short timer when an entry goes missing, cancel if it comes back.
        // Use 300ms on count drop (likely genuine disconnect), 800ms otherwise (bridge lag guard).
        Object.keys(trailerData).forEach(function(tid) {
          var found = false;
          for (var ti = 1; ti <= count; ti++) { if (String(el['tp_trid' + ti]) === tid) { found = true; break; } }
          if (!found) {
            if (trailerData[tid] && !trailerData[tid]._staleTimer) {
              trailerData[tid]._staleTimer = setTimeout((function(t) {
                return function() {
                  if (trailerData[t]) {
                    delete trailerData[t];
                    scope.$evalAsync(refreshDisplay);
                  }
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
          lua += 'electrics.values["tp_tc'+i+'"]=w and w.lastTemperature or 25 ';
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
      var pollStartTime = 0; // timestamp when poll last started, for isDef=false grace period
      var streamsList  = ['electrics', 'tireThermalData'];
      StreamsManager.add(streamsList);

      scope.$on('$destroy', function() {
        StreamsManager.remove(streamsList);
        stopPoll();
      });

      function stopPoll() {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        if (metaTimer)    { clearTimeout(metaTimer);     metaTimer    = null; }
      }

      function startPoll() {
        if (pollInterval) return;
        pollStartTime = Date.now();
        scope.visible = true;
        autoDetected  = false;
        metaRead      = false;
        wCount        = 0;
        rawPa         = [];
        rawTemp       = [];
        wheelStatus   = {};
        axleGroups    = [];
         scope.axles    = [];
         // trailerData intentionally NOT cleared here - trailer may already be coupled.
         // Debounce and stale cleanup handle genuine disconnects. Wiping here causes the
         // post-coupling blip: a vehicle event restarts the poll (pollInterval=null) and
         // the next startPoll() was deleting the just-built trailerData entry.

         // Bounce the electrics stream to force a fresh snapshot from the new vehicle.
         // Without this, RLS loaners (swapped via VehicleChange) may not deliver
         // updated electrics until the stream is re-registered.
         StreamsManager.remove(streamsList);
         StreamsManager.add(streamsList);

         // Explicitly set activeObject to the player vehicle before detectWheels.
         // On RLS loaner spawns, activeObject may not have switched yet even though
         // streamsUpdate is already delivering the new vehicle's electrics.
         
         detectWheels();
         updateTruckId();
         // scope.trailerSections intentionally not cleared - stays visible until processTrailerElectrics updates it
        pollInterval = setInterval(function() {
          var el = lastElectrics;
          detectWheels(); // always retry before el check - fires even when lastElectrics is null (e.g. RLS loaners post-softReset)
          if (!el) return;
          if (el.tp_vidname && el.tp_vidname !== currentVehicleId) {
            currentVehicleId = el.tp_vidname;
            scope.$evalAsync(function() { loadPrefs(currentVehicleId); });
          }
          var detected = el.tp_newcount;
          if (detected && detected !== wCount) {
            wCount = detected; rawPa = new Array(wCount).fill(0); rawTemp = new Array(wCount).fill(null);
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
          if (!metaRead && wCount > 0 && el.tp_metamark >= wCount) {
            var ok = true; var wheelMeta = [];
            for (var i = 0; i < wCount; i++) {
              if (el['tp_wname'+i] == null) { ok = false; break; }
              wheelMeta.push({ idx:i, name:String(el['tp_wname'+i]||''), node1:el['tp_wn1'+i], node2:el['tp_wn2'+i], offset:el['tp_woff'+i]||0, posY:el['tp_wposy'+i]||0 });
            }
            if (ok) {
              axleGroups = buildAxleGroups(wheelMeta); metaRead = true;
              var _names = wheelMeta.map(function(w){return w.name||'?';}).join(',');
              console.log("TRUCK WHEEL NAMES: "+_names);
              console.log("TRUCK AXLES built: "+axleGroups.length+" "+axleGroups.map(function(a){return a.label+"(L"+a.left.length+"R"+a.right.length+"sortKey="+a.sortKey+")";}).join(" "));
              if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
              scope.$evalAsync(refreshDisplay);
            }
          }
          if (!autoDetected && el.tp_isheavy != null) {
            autoDetected = true;
            if (el.tp_isheavy === 1) {
              pIdx = PRESET_CYCLE.indexOf('HEAVY');
              scope.$evalAsync(function() { scope.presetKey='HEAVY'; scope.presetLabel='HEAVY'; savePrefs(); });
            }
          }
          if (wCount > 0) { setupElectrics(wCount); }
          updateTruckId();
          pollTrailers();
        }, 200);
      }

      scope.$on('streamsUpdate', function(event, data) {
        if (!data.electrics) return;
        lastElectrics = data.electrics;
        if (lastElectrics.tp_truckid) cachedTruckObjId = lastElectrics.tp_truckid;
        // isDef: vehicle electrics are live. Career mode may not populate maxrpm/ignitionLevel
        // immediately after purchase - check additional keys as fallback.
        var isDef = lastElectrics.maxrpm        != undefined ||
                    lastElectrics.ignitionLevel != undefined ||
                    lastElectrics.wheelspeed    != undefined ||
                    lastElectrics.brake         != undefined ||
                    lastElectrics.throttle      != undefined;
        if (data.tireThermalData && data.tireThermalData.wheels) {
          var rawT = data.tireThermalData.wheels; thermals = {};
          var tKeys = Object.keys(rawT);
          for (var ti = 0; ti < tKeys.length; ti++) { thermals[tKeys[ti]] = rawT[tKeys[ti]]; thermals[ti] = rawT[tKeys[ti]]; }
        } else { thermals = {}; }
        if (isDef && !pollInterval) { console.log("STREAM startPoll (isDef=true)"); startPoll(); }
        else if (!isDef && pollInterval && (Date.now() - pollStartTime > 2000)) {
          console.log("STREAM isDef=false hiding app");
          stopPoll(); scope.visible = false;
          wCount = 0; axleGroups = []; scope.axles = [];
          // trailerSections preserved - trailer still attached
        }
        if (isDef) processTrailerElectrics(lastElectrics);
        if (isDef && wCount > 0) {
          var changed = false;
          for (var i = 0; i < wCount; i++) {
            var pa = lastElectrics['tp_pa'+i];
            if (pa != null && pa !== rawPa[i]) { rawPa[i] = pa; changed = true; }
            var tc = lastElectrics['tp_tc'+i];
            if (tc != null && tc !== rawTemp[i]) { rawTemp[i] = tc; changed = true; }
          }
          if (changed || data.tireThermalData) scope.$evalAsync(refreshDisplay);
        }
      });

      // ── Reset handlers ─────────────────────────────────────────────
      function fullReset() {
        console.log('fullReset called');
        stopPoll(); lastElectrics = null;
        wCount = 0; autoDetected = false; metaRead = false;
        rawPa = []; rawTemp = []; wheelStatus = {}; thermals = {}; axleGroups = [];
        lastTrailerCount = 0;
        focusedOnTrailer = false;
        focusedVehicleId = null; // clear so detectWheels doesn't target stale vehicle before next VehicleFocusChanged
        trailerSuppressUntil = 0;
        disabledTrailerIds = {};
        connectedTrailerIds = {};
        scope.axles = []; scope.visible = false;
      }

      function softReset(clearTrailers) {
        console.log('softReset called clearTrailers=' + !!clearTrailers);
        if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
        // Only wipe wheel data if we don't already have it - preserves detection that
        // happened before VehicleFocusChanged fires (e.g. RLS loaners with late focus events)
        if (!metaRead) {
          wCount = 0; autoDetected = false;
          rawPa = []; rawTemp = []; wheelStatus = {}; axleGroups = []; scope.axles = [];
        }
        metaRead = false;
        lastTrailerCount = 0;
        if (clearTrailers) {
          // Focus changed - wipe trailers AND lastElectrics so stale tp_trcount can't rebuild them.
          // Also set a suppression window (700ms) so the next few streamsUpdates don't re-flash
          // the stale bridge-written tp_trcount before pollTrailers() has re-queried it.
          Object.keys(trailerData).forEach(function(tid) {
            if (trailerData[tid] && trailerData[tid]._staleTimer) clearTimeout(trailerData[tid]._staleTimer);
          });
          trailerData = {};
          disabledTrailerIds = {};
          connectedTrailerIds = {};
          // Don't null lastElectrics - poll tick needs it to read tp_newcount for late-init vehicles.
          // Instead, scrub stale trailer keys so pollTrailers() can't rebuild from old data.
          if (lastElectrics) {
            delete lastElectrics.tp_trcount;
            delete lastElectrics.tp_truckid;
            delete lastElectrics.tp_newcount; // also clear wheel count so redetect triggers
          }
          cachedTruckObjId = 0; // invalidate truck ID so bridge queries restart cleanly
          trailerSuppressUntil = Date.now() + 700;
          // Bounce stream to force fresh electrics from the new vehicle.
          // Without this the poll keeps reading stale data from the previous loaner.
          StreamsManager.remove(streamsList);
          StreamsManager.add(streamsList);
          scope.$evalAsync(refreshDisplay);
        }
        // Don't clear focusedOnTrailer here - VehicleFocusChanged manages it
      }

      scope.$on('VehicleChange', function(e,d){ console.log('EV: VehicleChange'); fullReset(); });
      scope.$on('VehicleReload', function(e,d){ console.log('EV: VehicleReload'); fullReset(); });
      scope.$on('VehicleObjectChanged', function(e,d){ console.log('EV: VehicleObjectChanged'); softReset(false); });
      scope.$on('VehicleConfigChange', function(e,d){ console.log('EV: VehicleConfigChange'); softReset(false); });
      scope.$on('VehicleReset', function(e,d){ console.log('EV: VehicleReset'); softReset(false); });
      scope.$on('VehicleFocusChanged', function(event, data) {
        var newId = data && data.id ? String(data.id) : null;
        console.log('EV: VehicleFocusChanged id=' + newId);
        focusedVehicleId = newId;
        focusedOnTrailer = !!(newId && knownTrailerIds[newId]);
        if (focusedOnTrailer) {
          // Immediately clear all trailers - focused vehicle is a trailer, train readings are unreliable
          Object.keys(trailerData).forEach(function(tid) {
            if (trailerData[tid] && trailerData[tid]._staleTimer) clearTimeout(trailerData[tid]._staleTimer);
            delete trailerData[tid];
          });
          lastTrailerCount = 0;
          scope.$evalAsync(refreshDisplay);
        }
        if (!newId) { fullReset(); } else {
          softReset(true);
          // Retry detectWheels a few times after focus change to catch late-init vehicles.
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
