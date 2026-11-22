/* app.js — Mini App จดรายรับรายจ่าย (ธีมฟูจิ) */
(function () {
  var TZ = 7 * 3600 * 1000, DAY = 86400000;
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var WD = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var SRC_ICON = { slip: 'receipt', voice: 'microphone', text: 'keyboard', adjust: 'adjustments' };
  var SRC_NAME = { slip: 'สลิป', voice: 'เสียง', text: 'พิมพ์', adjust: 'ปรับยอด' };
  var ICONS = [['tools-kitchen-2', 'อาหาร'], ['coffee', 'กาแฟ'], ['baby-carriage', 'รถเข็นเด็ก'], ['baby-bottle', 'ขวดนม'], ['bolt', 'ไฟฟ้า'], ['wifi', 'อินเทอร์เน็ต'], ['home', 'บ้าน'], ['car', 'รถ'], ['gas-station', 'ปั๊มน้ำมัน'], ['basket', 'ตะกร้า'], ['heartbeat', 'สุขภาพ'], ['pill', 'ยา'], ['school', 'เรียน'], ['gift', 'ของขวัญ'], ['shirt', 'เสื้อผ้า'], ['device-mobile', 'มือถือ'], ['paw', 'สัตว์เลี้ยง'], ['plane', 'เที่ยว'], ['cash', 'เงินสด'], ['coin', 'เหรียญ'], ['pig-money', 'ออมสิน'], ['tag', 'ป้าย'], ['dots', 'อื่น ๆ']];
  var COLORS = ['#B8582A', '#2F6F8F', '#4F6A85', '#4E7A3A', '#B5524A', '#8A6236', '#993556', '#6B8494', '#3B6D11', '#854F0B'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n) {
    n = Number(n) || 0; var neg = n < 0; n = Math.abs(n);
    var s = Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : n.toFixed(2);
    var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + p.join('.');
  }
  function local(ms) { return new Date(ms + TZ); }
  function dayStart(ms) { var d = local(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TZ; }
  function dayLabel(dayMs, nowMs) {
    var diff = Math.round((dayStart(nowMs) - dayStart(dayMs)) / DAY);
    if (diff === 0) return 'วันนี้';
    if (diff === 1) return 'เมื่อวาน';
    return WD[local(dayMs).getUTCDay()];
  }
  function monthKey(ms) { var d = local(ms); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2); }
  function monthShift(mk, k) {
    var y = Number(mk.slice(0, 4)), m = Number(mk.slice(5)) - 1 + k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + ('0' + (m + 1)).slice(-2);
  }
  function monthLabel(mk) { return MONTHS[Number(mk.slice(5)) - 1] + ' ' + (Number(mk.slice(0, 4)) + 543); }
  function donutArcs(list, r) {
    var c = 2 * Math.PI * r, off = 0;
    return list.map(function (x) {
      var len = c * x.pct / 100, a = { dasharray: len + ' ' + (c - len), dashoffset: off ? -off : 0, color: x.color };
      off += len; return a;
    });
  }

  var App = { esc: esc, fmt: fmt, dayLabel: dayLabel, monthShift: monthShift, monthLabel: monthLabel, donutArcs: donutArcs };
  window.App = App;
  if (typeof document === 'undefined') return;

  // ---------------- UI ----------------
  var tg = window.Telegram && window.Telegram.WebApp;
  var demo = /[?&]demo=1/.test(location.search);
  var S = { tab: 'list', month: monthKey(Date.now()), data: null, editId: null, addPlan: false, acc: '', editCat: null, editPlan: null };
  var $ = function (id) { return document.getElementById(id); };

  if (tg) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#1F4A55'); tg.setBackgroundColor('#FBF8F4'); } catch (e) { /* old clients */ }
  }
  function haptic(t) { try { tg.HapticFeedback.notificationOccurred(t || 'success'); } catch (e) { /* none */ } }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2200); }
  function initData() { return tg ? tg.initData : ''; }

  function load() {
    $('monthName').textContent = monthLabel(S.month);
    if (demo) { S.data = demoData(); return render(); }
    if (!initData()) { $('view').innerHTML = '<p class="empty">เปิดหน้านี้จากปุ่ม "เปิดแอป" ในแชตบอทนะครับ</p>'; return; }
    fetch(window.API_URL + '?view=month&month=' + S.month + '&init=' + encodeURIComponent(initData()))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { $('view').innerHTML = '<p class="empty">' + esc(d.error || 'โหลดไม่สำเร็จ') + '</p>'; return; }
        S.data = d; render();
      })
      .catch(function () { $('view').innerHTML = '<p class="empty">โหลดไม่สำเร็จ ลองปิดแล้วเปิดใหม่</p>'; });
  }

  function post(action, payload) {
    if (demo) { toast('โหมดตัวอย่าง: ไม่ได้บันทึกจริง'); return Promise.resolve({ ok: true }); }
    return fetch(window.API_URL + '?api=1', { method: 'POST', body: JSON.stringify(Object.assign({ init: initData(), action: action }, payload || {})) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { haptic('error'); toast(d.error || 'ทำไม่สำเร็จ'); } else { haptic('success'); }
        return d;
      })
      .catch(function () { toast('เชื่อมต่อไม่ได้ ลองใหม่'); return { ok: false }; });
  }

  function catOf(name, dir) {
    var list = (S.data && S.data.categories) || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name && list[i].direction === dir) return list[i];
    if (name === 'ปรับยอด') return { icon: 'adjustments', color: '#6B8494' };
    return { icon: 'dots', color: '#6B8494' };
  }
  function icon(c) { return '<div class="ic" style="background:' + c.color + '22;color:' + c.color + '"><i class="ti ti-' + esc(c.icon) + '"></i></div>'; }
  function money(n, dir) { return '<span class="' + (dir === 'in' ? 'inc' : 'exp') + '">' + (dir === 'in' ? '+' : '-') + fmt(n) + '</span>'; }
  function opts(list, sel) { return list.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }

  function renderHero() {
    var d = S.data, total = 0, bal = d.balances || {}, names = (d.accounts || []).map(function (a) { return a.name; });
    Object.keys(bal).forEach(function (k) { total += bal[k]; if (names.indexOf(k) < 0) names.push(k); });
    if (S.acc && !(S.acc in bal)) S.acc = '';
    var sel = $('accSel');
    sel.innerHTML = '<option value="">ทุกบัญชี</option>' + names.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === S.acc ? ' selected' : '') + '>' + esc(n) + ' · ฿' + fmt(bal[n] || 0) + '</option>';
    }).join('');
    sel.value = S.acc;
    $('balTotal').textContent = '฿' + fmt(S.acc ? (bal[S.acc] || 0) : total);
    if (d.bgUrl && $('bg').dataset.src !== d.bgUrl) { $('bg').dataset.src = d.bgUrl; $('bg').src = d.bgUrl; }
  }

  function viewList() {
    var d = S.data, h = '<div class="totals"><span class="inc">รับ +' + fmt(d.totalIn) + '</span><span class="exp">จ่าย -' + fmt(d.totalOut) + '</span></div>';
    if (!d.days.length) return h + '<p class="empty">เดือนนี้ยังไม่มีรายการ<br>ส่งสลิป พิมพ์ หรือพูดในแชตบอทได้เลย</p>';
    d.days.forEach(function (day) {
      h += '<div class="dayh"><span class="num">' + local(day.day).getUTCDate() + '</span><span class="lbl">' + dayLabel(day.day, Date.now()) + '</span><span class="sum">' + money(Math.abs(day.net), day.net >= 0 ? 'in' : 'out') + '</span></div>';
      day.items.forEach(function (t) {
        var c = catOf(t.category, t.direction);
        h += '<button class="row" data-act="open" data-id="' + esc(t.id) + '">' + icon(c) +
          '<div class="name"><div>' + esc(t.item) + '</div><div class="sub"><i class="ti ti-' + (SRC_ICON[t.source] || 'point') + '"></i> ' + (SRC_NAME[t.source] || '') + ' · ' + esc(t.account) + '</div></div>' + money(t.amount, t.direction) + '</button>';
        if (S.editId === t.id) h += editForm(t);
      });
    });
    return h;
  }

  function editForm(t) {
    var cats = (S.data.categories || []).filter(function (c) { return c.direction === t.direction; }).map(function (c) { return c.name; });
    if (cats.indexOf(t.category) < 0) cats.unshift(t.category);
    return '<div class="edit" data-id="' + esc(t.id) + '">' +
      '<input id="eItem" value="' + esc(t.item) + '" placeholder="ค่าอะไร">' +
      '<div class="two"><input id="eAmount" type="number" inputmode="decimal" step="0.01" value="' + t.amount + '">' +
      '<select id="eAcc">' + opts(S.data.accounts.map(function (a) { return a.name; }), t.account) + '</select></div>' +
      '<select id="eCat">' + opts(cats, t.category) + '</select>' +
      '<div class="btns"><button class="btn pri" data-act="save">บันทึก</button><button class="btn del" data-act="del">ลบ</button><button class="btn" data-act="close">ปิด</button></div></div>';
  }

  function viewCats() {
    var d = S.data, list = d.byCategory;
    if (!list.length) return '<p class="empty">เดือนนี้ยังไม่มีรายจ่าย</p>';
    var arcs = donutArcs(list, 40);
    var svg = '<svg width="190" height="190" viewBox="0 0 120 120"><g transform="rotate(-90 60 60)" fill="none" stroke-width="15">' +
      arcs.map(function (a) { return '<circle cx="60" cy="60" r="40" stroke="' + a.color + '" stroke-dasharray="' + a.dasharray + '" stroke-dashoffset="' + a.dashoffset + '"/>'; }).join('') +
      '</g><text x="60" y="56" text-anchor="middle" font-size="8" fill="#7A6E62">รายจ่าย</text><text x="60" y="70" text-anchor="middle" font-size="12" font-weight="600" fill="#2A2420">฿' + fmt(d.totalOut) + '</text></svg>';
    return '<div class="donut">' + svg + '</div>' + list.map(function (c) {
      return '<div class="row">' + icon(c) + '<div class="name"><div>' + esc(c.name) + ' <span class="sub">' + c.pct + '%</span></div>' +
        '<div class="bar"><i style="width:' + c.pct + '%;background:' + c.color + '"></i></div></div><span>' + fmt(c.amount) + '</span></div>';
    }).join('');
  }

  function planRow(p) {
    var c = catOf(p.category, p.direction), pct = p.planned ? Math.min(100, p.actual * 100 / p.planned) : 0;
    var over = p.actual > p.planned, color = over ? 'var(--over)' : p.paid ? 'var(--in)' : 'var(--main2)';
    var right = p.paid && !over ? '<span class="inc"><i class="ti ti-check"></i> ' + fmt(p.actual) + '</span>'
      : p.actual > 0 ? '<span class="' + (over ? 'exp' : '') + '">' + fmt(p.actual) + ' / ' + fmt(p.planned) + '</span>'
        : '<span class="sub">' + fmt(p.planned) + '</span>';
    var due = p.dueDay ? dueText(p) : '';
    var h = '<button class="row" data-act="planEdit" data-id="' + esc(p.id) + '">' + icon(c) + '<div class="name"><div>' + esc(p.name) + '</div>' +
      (due ? '<div class="sub">' + due + '</div>' : '') +
      '<div class="bar"><i style="width:' + pct + '%;background:' + color + '"></i></div></div>' + right + '<i class="ti ti-pencil sub"></i></button>';
    if (S.editPlan === p.id) h += planForm(p);
    return h;
  }

  function dueText(p) {
    var d = p.dueThisMonth || p.dueDay, mName = MONTHS[Number(S.month.slice(5)) - 1];
    return 'ครบ ' + d + ' ' + mName + (p.dueDay > d ? ' (เดือนนี้ไม่มีวันที่ ' + p.dueDay + ' เลยใช้วันสุดท้าย)' : '');
  }
  var DUE_HINT = '<div class="sub">ถ้าเดือนไหนไม่มีวันที่นี้ (เช่น 29–31 ในเดือน ก.พ. หรือ 31 ในเดือนที่มี 30 วัน) จะครบวันสุดท้ายของเดือนนั้นแทน</div>';

  function planForm(p) {
    var cats = (S.data.categories || []).map(function (c) { return c.name + (c.direction === 'in' ? ' (รับ)' : ''); });
    var cur = p ? p.category + (p.direction === 'in' ? ' (รับ)' : '') : null;
    if (cur && cats.indexOf(cur) < 0) cats.unshift(cur);
    var btns = p
      ? '<button class="btn pri" data-act="savePlan">บันทึก</button><button class="btn del" data-act="delPlan">ลบ</button><button class="btn" data-act="planClose">ปิด</button>'
      : '<button class="btn pri" data-act="addPlan">เพิ่มในแผน</button><button class="btn" data-act="planCancel">ยกเลิก</button>';
    return '<div class="' + (p ? 'edit' : 'form') + '"><input id="pName" placeholder="ชื่อ เช่น ค่าไฟ" value="' + (p ? esc(p.name) : '') + '">' +
      '<div class="two"><input id="pAmount" type="number" inputmode="decimal" placeholder="ยอด" value="' + (p ? p.planned : '') + '">' +
      '<input id="pDue" type="number" inputmode="numeric" min="1" max="31" placeholder="ครบทุกวันที่ (1–31)" value="' + (p && p.dueDay ? p.dueDay : '') + '"></div>' +
      DUE_HINT + '<select id="pCat">' + opts(cats, cur) + '</select>' +
      '<div class="btns">' + btns + '</div></div>';
  }

  function viewPlan() {
    var ps = S.data.plans, outs = ps.filter(function (p) { return p.direction === 'out'; }), ins = ps.filter(function (p) { return p.direction === 'in'; });
    var paid = outs.filter(function (p) { return p.paid; }).length;
    var h = '<div class="card"><h3>แผนรายจ่าย <span class="sub">จ่ายแล้ว ' + paid + ' จาก ' + outs.length + ' รายการ</span></h3>' +
      (outs.length ? outs.map(planRow).join('') : '<p class="empty">ยังไม่มีแผนรายจ่าย</p>') + '</div>';
    if (ins.length) h += '<div class="card"><h3>แผนรายรับ</h3>' + ins.map(planRow).join('') + '</div>';
    h += '<div class="card">' + (S.addPlan ? planForm() : '<button class="row" style="justify-content:center;color:var(--main)" data-act="planOpen"><i class="ti ti-plus"></i> เพิ่มรายการในแผน</button>') + '</div>';
    return h;
  }

  function viewSet() {
    var d = S.data, h = '<div class="card"><h3>บัญชี</h3>';
    d.accounts.forEach(function (a) {
      h += '<div class="form" style="border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><b>' + esc(a.name) + '</b><span>คงเหลือ ' + fmt(a.balance) + '</span></div>' +
        '<div class="two"><input data-low="' + esc(a.name) + '" type="number" inputmode="decimal" placeholder="เตือนเมื่อต่ำกว่า" value="' + (a.lowAt == null ? '' : a.lowAt) + '">' +
        '<button class="btn" data-act="low" data-name="' + esc(a.name) + '">ตั้งเตือน</button>' +
        '<input data-adj="' + esc(a.name) + '" type="number" inputmode="decimal" placeholder="ยอดจริงตอนนี้">' +
        '<button class="btn" data-act="adj" data-name="' + esc(a.name) + '">ปรับยอด</button></div></div>';
    });
    h += '<div class="form"><div class="two"><input id="aName" placeholder="ชื่อบัญชีใหม่"><input id="aOpen" type="number" inputmode="decimal" placeholder="ยอดตอนนี้"></div><button class="btn pri" data-act="addAcc">เพิ่มบัญชี</button></div></div>';

    h += '<div class="card"><h3>หมวดหมู่</h3>';
    d.categories.forEach(function (c) {
      h += '<div class="row">' + icon(c) + '<div class="name"><div>' + esc(c.name) + '</div><div class="sub">' + (c.direction === 'in' ? 'รายรับ' : 'รายจ่าย') + '</div></div>' +
        '<button class="pill" data-act="editCat" data-name="' + esc(c.name) + '" data-dir="' + c.direction + '"><i class="ti ti-pencil"></i> แก้ไข</button>' +
        '<button class="pill" data-act="hideCat" data-name="' + esc(c.name) + '" data-dir="' + c.direction + '"><i class="ti ti-eye-off"></i> ซ่อน</button></div>';
      if (S.editCat === c.direction + '|' + c.name) h += catForm(c);
    });
    h += '<div class="form"><input id="cName" placeholder="ชื่อหมวดใหม่"><div class="two">' +
      '<select id="cDir"><option value="out">รายจ่าย</option><option value="in">รายรับ</option></select>' +
      '<select id="cIcon">' + ICONS.map(function (i) { return '<option value="' + i[0] + '">' + i[1] + '</option>'; }).join('') + '</select></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap" id="cColors">' + COLORS.map(function (c, i) { return '<button data-act="color" data-color="' + c + '" style="width:30px;height:30px;border-radius:50%;background:' + c + ';outline:' + (i === 0 ? '3px solid var(--accent)' : 'none') + '"></button>'; }).join('') + '</div>' +
      '<button class="btn pri" data-act="addCat">เพิ่มหมวด</button></div></div>';

    h += '<div class="card"><h3>พื้นหลัง</h3><button class="row" data-act="bg"><i class="ti ti-photo"></i> เปลี่ยนรูปพื้นหลัง</button></div>';
    return h;
  }

  function catForm(c) {
    var icons = ICONS.slice(); if (!icons.some(function (i) { return i[0] === c.icon; })) icons.unshift([c.icon, c.icon]);
    var colors = COLORS.slice(); if (colors.indexOf(c.color) < 0) colors.unshift(c.color);
    editColor = c.color;
    return '<div class="edit"><input id="ecName" value="' + esc(c.name) + '" placeholder="ชื่อหมวด"><div class="two">' +
      '<select id="ecDir"><option value="out"' + (c.direction === 'out' ? ' selected' : '') + '>รายจ่าย</option><option value="in"' + (c.direction === 'in' ? ' selected' : '') + '>รายรับ</option></select>' +
      '<select id="ecIcon">' + icons.map(function (i) { return '<option value="' + esc(i[0]) + '"' + (i[0] === c.icon ? ' selected' : '') + '>' + esc(i[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap" id="ecColors">' + colors.map(function (x) { return '<button data-act="ecolor" data-color="' + x + '" style="width:30px;height:30px;border-radius:50%;background:' + x + ';outline:' + (x === c.color ? '3px solid var(--accent)' : 'none') + '"></button>'; }).join('') + '</div>' +
      '<div class="sub">เปลี่ยนชื่อแล้ว รายการเก่าในหมวดนี้จะย้ายไปชื่อใหม่ด้วย</div>' +
      '<div class="btns"><button class="btn pri" data-act="saveCat">บันทึก</button><button class="btn" data-act="catClose">ปิด</button></div></div>';
  }

  function render() {
    renderHero();
    var v = S.tab === 'cats' ? viewCats() : S.tab === 'plan' ? viewPlan() : S.tab === 'set' ? viewSet() : viewList();
    $('view').innerHTML = v;
    var nm = $('nextM'); nm.style.visibility = S.month >= monthKey(Date.now()) ? 'hidden' : 'visible';
  }

  var newColor = COLORS[0], editColor = null;
  $('view').addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, val = function (id) { var x = $(id); return x ? x.value.trim() : ''; };
    if (act === 'open') { S.editId = S.editId === el.dataset.id ? null : el.dataset.id; return render(); }
    if (act === 'close') { S.editId = null; return render(); }
    if (act === 'save') {
      return post('updateTxn', { id: S.editId, patch: { item: val('eItem'), amount: Number(val('eAmount')), account: val('eAcc'), category: val('eCat') } })
        .then(function (r) { if (r.ok) { toast('บันทึกแล้ว'); S.editId = null; load(); } });
    }
    if (act === 'del') {
      var go = function (yes) { if (yes) post('deleteTxn', { id: S.editId }).then(function (r) { if (r.ok) { toast('ลบแล้ว'); S.editId = null; load(); } }); };
      return tg && tg.showConfirm ? tg.showConfirm('ลบรายการนี้ใช่ไหม?', go) : go(window.confirm('ลบรายการนี้ใช่ไหม?'));
    }
    if (act === 'planOpen') { S.addPlan = true; S.editPlan = null; return render(); }
    if (act === 'planEdit') { S.editPlan = S.editPlan === el.dataset.id ? null : el.dataset.id; S.addPlan = false; return render(); }
    if (act === 'planClose') { S.editPlan = null; return render(); }
    if (act === 'savePlan') {
      var pc = val('pCat'), pdue = val('pDue');
      if (!val('pName') || !(Number(val('pAmount')) > 0)) return toast('ใส่ชื่อและยอดก่อนนะครับ');
      if (pdue !== '' && !(Number(pdue) >= 1 && Number(pdue) <= 31)) return toast('วันครบกำหนดต้องเป็น 1–31');
      return post('updatePlan', { id: S.editPlan, patch: { name: val('pName'), amount: Number(val('pAmount')), dueDay: pdue === '' ? '' : Number(pdue),
        direction: / \(รับ\)$/.test(pc) ? 'in' : 'out', category: pc.replace(/ \(รับ\)$/, '') } })
        .then(function (r) { if (r.ok) { toast('แก้แผนแล้ว'); S.editPlan = null; load(); } });
    }
    if (act === 'delPlan') {
      var pid = S.editPlan;
      var goDel = function (yes) { if (yes) post('deletePlan', { id: pid }).then(function (r) { if (r.ok) { toast('ลบแผนแล้ว'); S.editPlan = null; load(); } }); };
      return tg && tg.showConfirm ? tg.showConfirm('ลบรายการนี้ออกจากแผน? รายการจ่ายที่บันทึกแล้วยังอยู่ครบ', goDel) : goDel(window.confirm('ลบรายการนี้ออกจากแผน?'));
    }
    if (act === 'editCat') { var key = el.dataset.dir + '|' + el.dataset.name; S.editCat = S.editCat === key ? null : key; return render(); }
    if (act === 'catClose') { S.editCat = null; return render(); }
    if (act === 'ecolor') {
      editColor = el.dataset.color;
      [].forEach.call(document.querySelectorAll('#ecColors button'), function (b) { b.style.outline = b === el ? '3px solid var(--accent)' : 'none'; });
      return;
    }
    if (act === 'saveCat') {
      var ck = S.editCat, cdir = ck.slice(0, ck.indexOf('|')), cname = ck.slice(ck.indexOf('|') + 1);
      if (!val('ecName')) return toast('ใส่ชื่อหมวดก่อนนะครับ');
      return post('updateCategory', { name: cname, direction: cdir, patch: { name: val('ecName'), direction: val('ecDir'), icon: val('ecIcon'), color: editColor } })
        .then(function (r) { if (r.ok) { toast('แก้หมวดแล้ว'); S.editCat = null; load(); } });
    }
    if (act === 'planCancel') { S.addPlan = false; return render(); }
    if (act === 'addPlan') {
      var cat = val('pCat'), dir = / \(รับ\)$/.test(cat) ? 'in' : 'out';
      if (!val('pName') || !(Number(val('pAmount')) > 0)) return toast('ใส่ชื่อและยอดก่อนนะครับ');
      if (val('pDue') !== '' && !(Number(val('pDue')) >= 1 && Number(val('pDue')) <= 31)) return toast('วันครบกำหนดต้องเป็น 1–31');
      var dupe = (S.data.plans || []).some(function (x) { return x.name === val('pName') && x.direction === dir; });
      var planBody = { plan: { name: val('pName'), direction: dir, amount: Number(val('pAmount')), dueDay: Number(val('pDue')) || '', category: cat.replace(/ \(รับ\)$/, '') } };
      var doAdd = function (yes) {
        if (!yes) return;
        if (S.adding) return; S.adding = true;
        post('addPlan', planBody).then(function (r) { S.adding = false; if (r.ok) { S.addPlan = false; toast('เพิ่มแผนแล้ว'); load(); } });
      };
      if (!dupe) return doAdd(true);
      var q = 'มี "' + val('pName') + '" ในแผนแล้ว จะเพิ่มซ้ำอีกอันไหม?';
      return tg && tg.showConfirm ? tg.showConfirm(q, doAdd) : doAdd(window.confirm(q));
    }
    if (act === 'low') {
      var lv = document.querySelector('[data-low="' + el.dataset.name + '"]').value;
      return post('setLowAt', { name: el.dataset.name, value: lv === '' ? null : Number(lv) }).then(function (r) { if (r.ok) { toast('ตั้งเตือนแล้ว'); load(); } });
    }
    if (act === 'adj') {
      var av = document.querySelector('[data-adj="' + el.dataset.name + '"]').value;
      if (av === '') return toast('ใส่ยอดจริงก่อนนะครับ');
      return post('adjustBalance', { name: el.dataset.name, value: Number(av) }).then(function (r) { if (r.ok) { toast('ปรับยอดแล้ว'); load(); } });
    }
    if (act === 'addAcc') {
      if (!val('aName')) return toast('ใส่ชื่อบัญชีก่อนนะครับ');
      return post('addAccount', { name: val('aName'), opening: Number(val('aOpen')) || 0 }).then(function (r) { if (r.ok) { toast('เพิ่มบัญชีแล้ว'); load(); } });
    }
    if (act === 'hideCat') {
      var name = el.dataset.name, dir2 = el.dataset.dir;
      var hide = function (yes) { if (yes) post('hideCategory', { name: name, direction: dir2 }).then(function (r) { if (r.ok) { toast('ซ่อนแล้ว'); load(); } }); };
      return tg && tg.showConfirm ? tg.showConfirm('ซ่อนหมวด ' + name + '? รายการเก่ายังอยู่ครบ', hide) : hide(window.confirm('ซ่อนหมวด ' + name + '?'));
    }
    if (act === 'color') {
      newColor = el.dataset.color;
      [].forEach.call(document.querySelectorAll('#cColors button'), function (b) { b.style.outline = b === el ? '3px solid var(--accent)' : 'none'; });
      return;
    }
    if (act === 'addCat') {
      if (!val('cName')) return toast('ใส่ชื่อหมวดก่อนนะครับ');
      return post('addCategory', { name: val('cName'), direction: val('cDir'), icon: val('cIcon'), color: newColor }).then(function (r) { if (r.ok) { toast('เพิ่มหมวดแล้ว'); load(); } });
    }
    if (act === 'bg') return $('bgFile').click();
  });

  [].forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.addEventListener('click', function () {
      [].forEach.call(document.querySelectorAll('.tabs button'), function (x) { x.classList.toggle('on', x === b); });
      S.tab = b.dataset.tab; S.editId = null; S.editCat = null; S.editPlan = null; S.addPlan = false; if (S.data) render(); window.scrollTo(0, 0);
    });
  });
  $('prevM').addEventListener('click', function () { S.month = monthShift(S.month, -1); load(); });
  $('nextM').addEventListener('click', function () { S.month = monthShift(S.month, 1); load(); });
  $('accSel').addEventListener('change', function () { S.acc = this.value; if (S.data) renderHero(); });
  $('bgBtn').addEventListener('click', function () { $('bgFile').click(); });
  $('bgFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      var w = Math.min(1280, img.width), h = Math.round(img.height * w / img.width), c = document.createElement('canvas');
      c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = c.toDataURL('image/jpeg', 0.85);
      $('bg').src = dataUrl; toast('กำลังบันทึกรูป…');
      post('setBackground', { data: dataUrl.split(',')[1] }).then(function (r) { if (r.ok) toast('เปลี่ยนพื้นหลังแล้ว'); });
      URL.revokeObjectURL(url);
    };
    img.src = url; this.value = '';
  });

  function demoData() {
    var now = Date.now(), today = dayStart(now), y = today - DAY;
    var cats = [['อาหาร', 'out', 'tools-kitchen-2', '#B8582A'], ['ของใช้ลูก', 'out', 'baby-carriage', '#2F6F8F'], ['บิล/ค่าน้ำไฟเน็ต', 'out', 'bolt', '#4F6A85'], ['ค่าบ้าน', 'out', 'home', '#4E7A3A'], ['เดินทาง/น้ำมัน', 'out', 'car', '#B5524A'], ['ขายของ', 'in', 'coin', '#3B6D11'], ['เงินเดือน/รายได้หลัก', 'in', 'cash', '#4E7A3A']]
      .map(function (c) { return { name: c[0], direction: c[1], icon: c[2], color: c[3] }; });
    var t = function (id, at, dir, item, cat, amt, acc, src) { return { id: id, at: at, direction: dir, item: item, category: cat, amount: amt, account: acc, source: src }; };
    return {
      ok: true, totalIn: 18500, totalOut: 6050, balances: { 'เงินสด': 2450, 'กสิกร': 10000 },
      days: [{ day: today, net: -365, items: [t('T5', today + 9e6, 'out', 'กาแฟ', 'อาหาร', 65, 'เงินสด', 'text'), t('T4', today + 8e6, 'out', 'นมผง', 'ของใช้ลูก', 180, 'กสิกร', 'slip'), t('T3', today + 7e6, 'out', 'ข้าวกลางวัน', 'อาหาร', 120, 'เงินสด', 'voice')] },
        { day: y, net: 500, items: [t('T2', y + 6e6, 'in', 'ค่าขายของ', 'ขายของ', 500, 'กสิกร', 'text')] }],
      byCategory: [{ name: 'อาหาร', icon: 'tools-kitchen-2', color: '#B8582A', amount: 2420, pct: 40 }, { name: 'ของใช้ลูก', icon: 'baby-carriage', color: '#2F6F8F', amount: 1815, pct: 30 }, { name: 'บิล/ค่าน้ำไฟเน็ต', icon: 'bolt', color: '#4F6A85', amount: 1210, pct: 20 }, { name: 'เดินทาง/น้ำมัน', icon: 'car', color: '#B5524A', amount: 605, pct: 10 }],
      plans: [{ id: 'P1', name: 'ค่าบ้าน', direction: 'out', category: 'ค่าบ้าน', planned: 5000, actual: 5000, paid: true, dueDay: 5 }, { id: 'P2', name: 'ค่าไฟ', direction: 'out', category: 'บิล/ค่าน้ำไฟเน็ต', planned: 1500, actual: 1210, paid: false, dueDay: 25 },
        { id: 'P3', name: 'นม/ผ้าอ้อม', direction: 'out', category: 'ของใช้ลูก', planned: 1500, actual: 1815, paid: true, dueDay: null }, { id: 'P4', name: 'อินเทอร์เน็ต', direction: 'out', category: 'บิล/ค่าน้ำไฟเน็ต', planned: 600, actual: 0, paid: false, dueDay: 25 },
        { id: 'P5', name: 'รายรับประจำ', direction: 'in', category: 'เงินเดือน/รายได้หลัก', planned: 18000, actual: 18000, paid: true, dueDay: 1 }],
      categories: cats, accounts: [{ name: 'เงินสด', opening: 0, lowAt: null, balance: 2450 }, { name: 'กสิกร', opening: 5000, lowAt: 1000, balance: 10000 }], bgUrl: null
    };
  }

  load();
})();
