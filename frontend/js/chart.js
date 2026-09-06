// 순수 SVG 라인차트 (보너스 과제: 추세 시각화). 라이브러리 없음.
const Chart = (() => {
  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  function shortNum(n) {
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + "억";
    if (Math.abs(n) >= 1e4) return Math.round(n / 1e4).toLocaleString() + "만";
    return Math.round(n).toLocaleString();
  }

  // rows: [{date, value}] 오름차순, opts: {height, grid, average, label}
  function render(host, rows, opts) {
    const o = opts || {};
    const H = o.height || 300;
    const W = 1000;
    host.innerHTML = "";
    if (!rows.length) {
      host.innerHTML = '<p class="empty">그래프를 그릴 데이터가 없어요.</p>';
      return;
    }

    const vals = rows.map((r) => Number(r.value));
    const lo = Math.min.apply(null, vals) * 0.96;
    const hi = Math.max.apply(null, vals) * 1.03;
    const x = (i) => (i / Math.max(1, rows.length - 1)) * W;
    const y = (v) => H - ((v - lo) / (hi - lo || 1)) * H;

    const svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H, height: H, role: "img",
      "aria-label": o.label || rows.length + "개 값 추이 선 그래프",
    });

    if (o.grid) {
      for (let k = 0; k <= 3; k++) {
        const gy = (H / 3) * k;
        svg.appendChild(svgEl("line", { x1: 0, y1: gy, x2: W, y2: gy, stroke: "var(--bd)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
        const t = svgEl("text", { x: 0, y: gy + 14, fill: "var(--dim)", "font-family": "IBM Plex Mono, monospace", "font-size": 15 });
        t.textContent = shortNum(hi - ((hi - lo) / 3) * k);
        svg.appendChild(t);
      }
    }

    if (typeof o.average === "number") {
      svg.appendChild(svgEl("line", {
        x1: 0, y1: y(o.average), x2: W, y2: y(o.average), stroke: "var(--acc)",
        "stroke-width": 1, "stroke-dasharray": "5 5", opacity: 0.6, "vector-effect": "non-scaling-stroke",
      }));
    }

    const d = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    svg.appendChild(svgEl("path", { d: d + " L" + W + " " + H + " L0 " + H + " Z", fill: "color-mix(in oklch, var(--acc) 12%, transparent)" }));
    svg.appendChild(svgEl("path", { d: d, fill: "none", stroke: "var(--acc)", "stroke-width": o.thin ? 1.8 : 2, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }));
    if (!o.thin) {
      svg.appendChild(svgEl("circle", { cx: x(rows.length - 1), cy: y(vals[vals.length - 1]), r: 4, fill: "var(--acc)" }));
    }
    host.appendChild(svg);
  }

  function xLabels(host, rows) {
    if (!host) return;
    host.innerHTML = "";
    if (!rows.length) return;
    const idx = [0, Math.floor(rows.length / 3), Math.floor((rows.length * 2) / 3), rows.length - 1];
    idx.forEach((i) => {
      const s = document.createElement("span");
      s.textContent = rows[i] ? rows[i].date.slice(5) : "";
      host.appendChild(s);
    });
  }

  return { render: render, xLabels: xLabels };
})();
