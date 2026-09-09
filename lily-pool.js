(function () {
  const svg = document.getElementById('scene');
  if (!svg) return;
  const MAX_DIST = 380;
  const EYE_TRAVEL = 9;
  // Matches the <svg id="scene"> viewBox in index.html (cropped tight to the
  // artwork's actual y-extent, so there's no dead space baked into the
  // coordinate system).
  const VIEWBOX_Y_MIN = 0;
  const VIEWBOX_HEIGHT = 1600;
  const SCENE_ASPECT = 2650 / VIEWBOX_HEIGHT;
  const SCENE_MAX_WIDTH = 1400;

  // CSS-only max-width/max-height sizing on a raw inline <svg> is unreliable
  // across engines: browsers were sizing by width first and letting the
  // derived height overflow #hero's box (clipped by overflow:hidden), rather
  // than honoring max-height. Compute the exact contain-fit in JS instead.
  const hero = document.getElementById('hero');
  function sizeScene() {
    if (!hero) return;
    const cs = getComputedStyle(hero);
    const availW = hero.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = hero.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let w = Math.min(availW, SCENE_MAX_WIDTH);
    let h = w / SCENE_ASPECT;
    if (h > availH) {
      h = availH;
      w = h * SCENE_ASPECT;
    }
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
  }
  sizeScene();
  window.addEventListener('resize', sizeScene);

  // --- master single-lily artwork: open state, closed state (doubles as blink) ---
  const MASTER_OPEN_D = "M461.5 401L517 193L510 410L607.5 212.5C607.5 212.5 556 432.056 548.5 453.5C541 474.944 509.2 516.765 442 512.5C407.5 523.333 330.9 524 300.5 440C270.1 356 237.167 267.333 224.5 233.5L346.5 410L328.5 201.5L411.5 401L430 187L461.5 401ZM437.33 439.042C414.091 437.992 404.761 456.971 403 466.592C410.262 470.309 428.351 477.349 442.611 475.774C456.872 474.2 467.479 462.873 471 457.407C469.459 451.722 460.568 440.091 437.33 439.042Z";
  const MASTER_CLOSED_D = "M453.5 341L442 197L487 336.5L456 207C456.079 207.099 581.994 364.021 565.499 429C548.999 494 509.2 516.765 442 512.5C407.5 523.333 330.9 524 300.5 440C270.1 356 396.127 245 404 207L377.5 336.5L415.501 197V341L430 187L453.5 341ZM471 457.407C459 464.999 451.5 468.776 440 469.999C428.5 471.222 418 469.999 403 466.592C410.262 470.309 428.351 477.349 442.611 475.774C456.872 474.2 467.479 462.873 471 457.407Z";
  const EYE_OPEN = { x: 435.5, y: 449.5 };
  const EYE_CLOSED = { x: 438.5, y: 457.5 };
  const PUPIL_OPEN = { x: 436, y: 450 };
  const PUPIL_CLOSED = { x: 439, y: 458 };
  const FLOWER_CENTER_LOCAL = { x: 415, y: 340 }; // proximity anchor, in master's local frame

  function tokenize(d) { return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g); }
  // Stateful parser: M/L/C give explicit x,y pairs, but V (vertical-lineto)
  // and H (horizontal-lineto) only supply one coordinate and reuse the
  // other from the current point. Pairing tokens naively would desync
  // everything after a V/H, so track position instead.
  function numsFromD(d) {
    const tokens = tokenize(d);
    const pairs = [];
    let i = 0, curX = 0, curY = 0, startX = 0, startY = 0;
    while (i < tokens.length) {
      const cmd = tokens[i]; i++;
      if (cmd === 'M' || cmd === 'L') {
        curX = parseFloat(tokens[i]); curY = parseFloat(tokens[i + 1]); i += 2;
        pairs.push({ x: curX, y: curY });
        if (cmd === 'M') { startX = curX; startY = curY; }
      } else if (cmd === 'C') {
        for (let k = 0; k < 3; k++) {
          curX = parseFloat(tokens[i]); curY = parseFloat(tokens[i + 1]); i += 2;
          pairs.push({ x: curX, y: curY });
        }
      } else if (cmd === 'V') {
        curY = parseFloat(tokens[i]); i += 1;
        pairs.push({ x: curX, y: curY });
      } else if (cmd === 'H') {
        curX = parseFloat(tokens[i]); i += 1;
        pairs.push({ x: curX, y: curY });
      } else if (cmd === 'Z' || cmd === 'z') {
        curX = startX; curY = startY;
      }
    }
    return pairs;
  }
  const MASTER_TOKENS = tokenize(MASTER_OPEN_D);
  const MASTER_PAIRS_OPEN = numsFromD(MASTER_OPEN_D);
  const MASTER_PAIRS_CLOSED = numsFromD(MASTER_CLOSED_D);

  // solve exact affine transform mapping 3 master anchor points to 3 instance points
  function solveAffine(mp, ip) {
    const v1 = { x: mp[1].x - mp[0].x, y: mp[1].y - mp[0].y };
    const v2 = { x: mp[2].x - mp[0].x, y: mp[2].y - mp[0].y };
    const w1 = { x: ip[1].x - ip[0].x, y: ip[1].y - ip[0].y };
    const w2 = { x: ip[2].x - ip[0].x, y: ip[2].y - ip[0].y };
    const det = v1.x * v2.y - v1.y * v2.x;
    const iv = [ v2.y / det, -v2.x / det, -v1.y / det, v1.x / det ];
    const a = w1.x * iv[0] + w2.x * iv[2];
    const c = w1.x * iv[1] + w2.x * iv[3];
    const b = w1.y * iv[0] + w2.y * iv[2];
    const d = w1.y * iv[1] + w2.y * iv[3];
    const e = ip[0].x - (a * mp[0].x + c * mp[0].y);
    const f = ip[0].y - (b * mp[0].x + d * mp[0].y);
    return { a, b, c, d, e, f };
  }
  function applyAffine(m, p) {
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  }
  function applyAffineArr(m, pts) { return pts.map(p => applyAffine(m, p)); }

  function buildPathFromPairs(pairs) {
    let pi = 0;
    const out = [];
    for (const tok of MASTER_TOKENS) {
      if (/[a-zA-Z]/.test(tok)) { out.push(tok); continue; }
      const pair = pairs[Math.floor(pi / 2)];
      out.push((pi % 2 === 0 ? pair.x : pair.y).toFixed(2));
      pi++;
    }
    return out.join(' ');
  }

  function lerpPairs(a, b, f) {
    return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * f, y: p.y + (b[i].y - p.y) * f }));
  }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // --- pool data: real per-flower artwork (used only to derive each instance's
  //     affine transform) and real per-lily stem geometry ---
  const POOL_FLOWER_D = [
    'M1546.48 392.256L1472.67 190.025L1498.97 405.539L1384.27 217.507C1384.27 217.507 1455.12 431.604 1464.5 452.295C1473.88 472.986 1509.28 511.809 1575.83 501.576C1611.16 509.294 1687.51 503.136 1710.31 416.763C1733.11 330.389 1758.01 239.142 1767.62 204.315L1661.82 390.979L1661.18 181.704L1596.28 387.803L1558.79 176.301L1546.48 392.256ZM1573.94 427.994C1596.99 424.879 1607.97 442.952 1610.58 452.377C1603.68 456.726 1586.29 465.349 1571.95 465.051C1557.6 464.753 1546.03 454.416 1542.04 449.285C1543.07 443.486 1550.89 431.109 1573.94 427.994Z',
    'M479.186 449.106L463.21 234.422L527.948 441.658L555.089 223.082C555.089 223.082 578.643 447.363 578.611 470.081C578.578 492.799 562.297 542.751 497.431 560.818C468.411 582.392 396.29 608.208 339.961 538.874C283.632 469.54 223.376 396.632 200.289 368.844L373.539 495.417L287.985 304.428L431.966 465.546L379.074 257.361L479.186 449.106ZM468.868 492.98C446.576 499.629 444.004 520.621 445.505 530.285C453.585 531.408 472.984 532.108 485.933 525.933C498.883 519.758 505.176 505.573 506.704 499.253C503.38 494.391 491.159 486.33 468.868 492.98Z',
    'M1163 364L1218.5 156L1211.5 373L1309 175.5C1309 175.5 1257.5 395.056 1250 416.5C1242.5 437.944 1210.7 479.765 1143.5 475.5C1109 486.333 1032.4 487 1002 403C971.6 319 938.667 230.333 926 196.5L1048 373L1030 164.5L1113 364L1131.5 150L1163 364ZM1138.83 402.042C1115.59 400.992 1106.26 419.971 1104.5 429.592C1111.76 433.309 1129.85 440.349 1144.11 438.774C1158.37 437.2 1168.98 425.873 1172.5 420.407C1170.96 414.722 1162.07 403.091 1138.83 402.042Z',
    'M1491.44 687.038L1584.34 492.842L1537.44 704.829L1669.7 528.698C1669.7 528.698 1578.59 734.99 1567.26 754.683C1555.93 774.376 1516.97 809.615 1451.71 793.029C1415.8 797.314 1340.39 783.842 1326 695.677C1311.62 607.511 1295.6 514.291 1289.39 478.702L1376.75 674.675L1397.51 466.432L1442.29 677.817L1499.94 470.9L1491.44 687.038ZM1460.66 719.97C1438.02 714.653 1425.35 731.585 1421.84 740.716C1428.29 745.708 1444.77 755.964 1459.08 757.047C1473.39 758.129 1485.9 748.953 1490.37 744.23C1489.9 738.359 1483.31 725.287 1460.66 719.97Z',
    'M2083 400L2138.5 192L2131.5 409L2229 211.5C2229 211.5 2177.5 431.056 2170 452.5C2162.5 473.944 2130.7 515.765 2063.5 511.5C2029 522.333 1952.4 523 1922 439C1891.6 355 1858.67 266.333 1846 232.5L1968 409L1950 200.5L2033 400L2051.5 186L2083 400ZM2058.83 438.042C2035.59 436.992 2026.26 455.971 2024.5 465.592C2031.76 469.309 2049.85 476.349 2064.11 474.774C2078.37 473.2 2088.98 461.873 2092.5 456.407C2090.96 450.722 2082.07 439.091 2058.83 438.042Z',
    'M819.476 504.256L745.673 302.025L771.97 517.539L657.269 329.507C657.269 329.507 728.117 543.604 737.497 564.295C746.877 584.986 782.275 623.809 848.828 613.576C884.156 621.294 960.511 615.136 983.309 528.763C1006.11 442.389 1031.01 351.142 1040.62 316.315L934.821 502.979L934.181 293.704L869.277 499.803L831.793 288.301L819.476 504.256ZM846.938 539.994C869.991 536.879 880.975 554.952 883.585 564.377C876.683 568.726 859.292 577.349 844.949 577.051C830.605 576.753 819.031 566.416 815.037 561.285C816.065 555.486 823.885 543.109 846.938 539.994Z',
    'M1744.48 554.256L1670.67 352.025L1696.97 567.539L1582.27 379.507C1582.27 379.507 1653.12 593.604 1662.5 614.295C1671.88 634.986 1707.28 673.809 1773.83 663.576C1809.16 671.294 1885.51 665.136 1908.31 578.763C1931.11 492.389 1956.01 401.142 1965.62 366.315L1859.82 552.979L1859.18 343.704L1794.28 549.803L1756.79 338.301L1744.48 554.256ZM1771.94 589.994C1794.99 586.879 1805.97 604.952 1808.58 614.377C1801.68 618.726 1784.29 627.349 1769.95 627.051C1755.6 626.753 1744.03 616.416 1740.04 611.285C1741.07 605.486 1748.89 593.109 1771.94 589.994Z',
    'M674.739 616.685L715.893 462.449L710.702 623.358L783 476.909C782.957 477.094 744.809 639.722 739.251 655.614C733.69 671.515 710.109 702.526 660.279 699.363C634.697 707.396 577.898 707.891 555.355 645.604C532.813 583.316 508.393 517.568 499 492.48L589.465 623.358L576.117 468.752L637.663 616.685L651.381 458L674.739 616.685ZM656.816 644.893C639.585 644.114 632.666 658.187 631.36 665.321C636.745 668.077 650.159 673.298 660.733 672.131C671.307 670.963 679.172 662.565 681.783 658.512C680.641 654.296 674.048 645.671 656.816 644.893Z',
    'M1182.74 589.685L1223.89 435.449L1218.7 596.358L1291 449.909C1290.96 450.094 1252.81 612.722 1247.25 628.614C1241.69 644.515 1218.11 675.526 1168.28 672.363C1142.7 680.396 1085.9 680.891 1063.36 618.604C1040.81 556.316 1016.39 490.568 1007 465.48L1097.46 596.358L1084.12 441.752L1145.66 589.685L1159.38 431L1182.74 589.685ZM1164.82 617.893C1147.58 617.114 1140.67 631.187 1139.36 638.321C1144.75 641.077 1158.16 646.298 1168.73 645.131C1179.31 643.963 1187.17 635.565 1189.78 631.512C1188.64 627.296 1182.05 618.671 1164.82 617.893Z',
    'M2315.23 559.009L2416.95 435.988L2345.13 580.073L2471.92 477.116C2471.8 477.266 2369.31 609.169 2357.63 621.295C2345.94 633.428 2311.58 651.78 2267.61 628.126C2241.01 624.758 2189.17 601.521 2194.66 535.508C2200.15 469.495 2205.37 399.552 2207.3 372.833L2234.94 529.514L2287.28 383.426L2281.53 543.548L2360.17 405.041L2315.23 559.009ZM2287.18 577.173C2271.84 569.28 2259.68 579.186 2255.52 585.125C2259.26 589.876 2269.28 600.215 2279.38 603.563C2289.47 606.912 2300.12 602.559 2304.19 599.963C2304.91 595.656 2302.51 585.067 2287.18 577.173Z'
  ];
  const POOL_STEM_D = [
    'M1141.84 465.586C1141.84 496.082 1140.92 562.886 1136.08 586.26C1132.74 602.393 1125.28 626.675 1104 677.556C1082.72 728.438 1047.25 805.05 1026.54 848.173C994.904 914.066 972.81 930.238 965.12 945.241C961.009 953.262 961.874 970.766 962.505 990.457C963.068 1008.05 980.315 1015 993.053 1021.56C1004.17 1027.28 1026.38 1014.16 1042.51 1004.74C1055.15 997.37 1074.54 977.495 1110.46 950.736C1137.99 930.234 1180.73 919.401 1225.89 908.799C1248.93 903.392 1273.01 901.653 1301.54 900.075C1398.98 894.685 1411.04 901.085 1434.82 915.427C1464.93 933.591 1471.4 953.996 1477.5 968.592C1483.05 981.84 1483.85 1017.27 1482.7 1074.83C1482.07 1106.05 1477 1141.2 1474.25 1173.54C1469.09 1234.24 1467.32 1270.48 1463.79 1285.55C1455.68 1320.2 1433.47 1347.67 1418.05 1364.09C1406.89 1375.97 1381.98 1388.31 1356.87 1401.47C1342.91 1408.79 1305.06 1415.44 1233.05 1424.2C1194.28 1428.91 1150.39 1428.19 1123.45 1427.84C1096.52 1427.49 1087.71 1425.99 1054.59 1416.36C1021.48 1406.72 964.314 1388.99 930.595 1377.38C887.676 1362.61 871.323 1348.68 855.337 1333.34C816.369 1295.95 804.411 1247.65 800.423 1223C799.408 1216.72 800.718 1211.64 802.083 1207.96C807.088 1194.47 833.291 1186.67 906.035 1170.09C927.089 1166.88 946.086 1165.87 958.331 1166.26C970.577 1166.65 975.495 1168.47 984.511 1172.54',
    'M1577.1 487.467C1577.1 487.563 1577.1 487.66 1577.17 516.024C1577.24 544.389 1577.38 601.018 1578.11 631.808C1578.92 665.884 1590.28 699.887 1604.2 747.983C1610.16 768.589 1614.68 775.749 1620.51 782.95C1631.46 796.47 1685.85 800.308 1738.85 816.369C1767.33 824.999 1784.54 841.067 1793.03 848.404C1801.46 855.685 1820.37 897.619 1848.22 963.757C1860.59 993.151 1865.36 1015.71 1869.76 1037.91C1878.4 1081.44 1881.08 1121.66 1881.95 1150.2C1882.74 1176.28 1845.5 1197.85 1818.79 1206.81C1777.3 1220.71 1742.55 1206.34 1719.2 1205.66C1662.93 1204.02 1620.97 1203.91 1610.92 1199.84C1598.34 1194.75 1584.78 1185.28 1573.07 1176.31C1565.57 1170.56 1566.46 1138.15 1572 1084.42C1574.75 1057.76 1585.72 1033.52 1596.29 1011.27C1632.84 934.319 1668.58 911.545 1680.88 905.78C1684.08 904.28 1688.33 904.265 1728.47 900.697C1768.61 897.129 1844.74 890.621 1903.51 883.866C1962.27 877.11 2001.37 870.303 2050.48 865.522C2099.59 860.741 2157.54 858.193 2192.27 863.847C2240.27 871.661 2264.01 916.981 2295.16 950.664C2318.21 975.586 2332.86 986.108 2338.24 992.21C2360.85 1017.88 2342.36 1076.98 2330.96 1092.27C2328.67 1095.34 2325.03 1096.54 2292.98 1107.67C2260.93 1118.79 2199.86 1139.09 2161.9 1150.73C2093.75 1171.65 2064.02 1181.11 2038.22 1196.66C2015.04 1210.63 2009.24 1224.39 1988.57 1277.81C1963.99 1341.35 1953.26 1389.06 1946.98 1400.18C1934.09 1423.03 1903.88 1434.45 1841.65 1443.74C1790.95 1451.31 1700.46 1457.27 1651.58 1461.16C1602.69 1465.05 1597.9 1464.8 1593.9 1465.08C1589.9 1465.36 1586.85 1466.18 1583.7 1467.03',
    'M479.061 553.393C483.322 557.17 502.272 594.088 507.91 667.294C509.313 685.501 493.87 735.657 466.772 826.476C439.799 916.877 418.99 964.831 415.628 978.914C409.212 1005.79 401.572 1051.72 397.223 1105.01C391.776 1171.76 407.765 1205.97 437.164 1258.68C450.673 1282.89 486.863 1308.17 525.028 1337.27C545.465 1352.85 569.421 1355.13 596.966 1354.67C612.547 1354.41 650.831 1339.78 708.568 1315.08C781.3 1283.95 800.019 1236.22 821.076 1193.52C840.823 1153.48 835.154 1135.67 832.373 1126.82C821.944 1093.64 772.253 1088.72 748.435 1087.59C713.691 1085.94 671.935 1140.15 658.912 1161.68C639.966 1193.01 641.764 1243.61 649.355 1273.01C651.845 1282.66 694.956 1303.33 753.435 1334.6C799.042 1358.99 826.635 1359.92 879.387 1363.4C915.801 1365.8 972.048 1364.33 1006.42 1362.97C1051.77 1361.18 1072.24 1352.82 1090.15 1345.37C1106.25 1338.67 1143.29 1314.28 1201.98 1279.23C1254.48 1247.89 1301.63 1238.48 1337.21 1230.85C1376.23 1222.49 1431 1223.22 1484.37 1225.54C1511.94 1226.74 1553.39 1267.45 1611.54 1320.93C1660.06 1365.54 1676.27 1380.14 1726.5 1390.94C1800.09 1406.75 1860.95 1400.55 1882.78 1397.72C1924.85 1392.27 1952.84 1354.93 1971.57 1331.61C1975.39 1325.78 1979.01 1319.28 1981.62 1314.24C1984.23 1309.19 1985.71 1305.81 1987.24 1300.19',
    'M654.807 692.547C654.372 721.775 651.695 792.401 651.903 834.022C652.055 864.643 702.572 893.286 752.764 916.429C812.828 944.125 865.309 949.039 889.056 963.931C931.563 990.588 959.007 1019.07 969.362 1035.39C983.943 1058.36 993.558 1089.11 1000.62 1129.74C1018.11 1230.29 997.174 1250.63 974.142 1289.26C953.773 1323.43 926.49 1349.34 905.896 1367.58C885.732 1385.43 859.068 1397.58 830.276 1409.9C800.152 1422.79 778.314 1426.76 739.32 1428.79C705.071 1430.58 641.376 1431.99 605.819 1432.55C548.545 1433.45 492.501 1403.74 455.28 1380.38C424.02 1360.75 396.764 1312.55 382.948 1273.96C364.873 1223.48 376.29 1190.29 384.548 1169.43C395.956 1140.62 426.775 1122.58 498.989 1080.22C524.078 1068.48 542.535 1063.07 562.385 1059.94C572.921 1058.88 584.397 1058.88 596.22 1058.88',
    'M851.807 606.866C851.807 606.618 850.613 656.295 845.232 759.733C842.437 813.455 833.902 869.314 830.043 911.386C823.767 979.799 827.366 1015.94 832.052 1033.31C836.813 1050.97 844.291 1062 863.174 1079.97C943.979 1156.87 964.286 1162.17 986.092 1166.82C1008.31 1171.55 1053.47 1174.86 1121.01 1184.3C1157.71 1189.43 1200.13 1188.56 1238.78 1191.91C1311.55 1198.21 1351.6 1208.76 1361.87 1212.03C1399.28 1223.92 1445.81 1265.17 1454.83 1279.07C1459.1 1285.66 1460.42 1294.78 1460.71 1303.94C1447.13 1320.04 1412.59 1340.35 1358.23 1359.62C1339.34 1362.57 1314.81 1362.83 1282.95 1356.1',
    'M1169.52 671.575C1169.52 671.451 1169.52 671.327 1169.52 719.326C1169.52 767.325 1169.52 863.451 1167 925.028C1162.28 1040.14 1145.24 1054.86 1124.86 1085.11C1114.59 1100.36 1100.49 1141.62 1082.34 1193.4C1073.98 1217.27 1064.22 1243.92 1049.1 1285.98C1035.4 1324.07 1024.57 1364.32 1011.75 1397.13C1005.64 1412.77 987.446 1424.72 962.737 1438.92C937.117 1453.65 896.018 1441.78 874.069 1432.27C854.019 1423.58 841.874 1402.43 824.705 1378.44C792.853 1333.93 776.347 1297 771.485 1283.45C764.165 1263.06 761.147 1235.91 754.873 1188.65C743.515 1103.09 731.301 1040.73 726.447 1025.5C719.383 1003.33 707.162 980.071 692.661 964.788C679.059 950.453 625.553 940.229 529.824 932.858C508.335 931.204 500.39 935.871 478.548 949.197C425.46 981.584 376.967 1013.75 346.379 1026.08C331.222 1031.45 316.807 1035 306.26 1036.99C295.714 1038.99 289.472 1039.32 283.041 1039.65',
    'M1423.05 788.713C1361.36 859.57 1315.27 899.99 1309.77 907.553C1293.37 930.061 1274.12 970.711 1264 1000.01C1260.84 1009.16 1265.42 1019.68 1271.77 1030.84C1288.95 1061 1326.52 1073.51 1358.64 1084.18C1377.7 1090.51 1428.97 1089.99 1499.84 1088.76C1551.66 1087.86 1588.79 1081.54 1614.93 1082.21C1644.52 1082.96 1677.94 1136.97 1699.33 1178.91C1719.69 1218.82 1712.81 1253.3 1694.53 1295.39C1668.55 1355.24 1622.77 1394.85 1604.86 1412.83C1574.8 1442.98 1515.1 1455.74 1467.16 1459.57C1372.11 1467.18 1306.36 1458.53 1295.42 1455.79C1259.44 1446.77 1217.67 1407.38 1182.14 1364.07C1169.18 1348.29 1165.46 1327.95 1161.93 1287.4C1152.7 1181.48 1174.51 1153.12 1187.86 1131.54C1196.7 1117.25 1215.87 1111.47 1243.42 1106.87C1304.13 1096.73 1349.08 1134.8 1403.75 1155.09C1429.63 1164.7 1449.77 1181.52 1482.68 1210.94C1535.28 1257.96 1547.45 1303.11 1553.53 1345.34C1558.28 1378.27 1551.98 1400.76 1545.62 1407.21C1531.35 1421.69 1513.9 1427.92 1482.22 1453.12C1458.09 1472.32 1428.77 1484.98 1392.33 1499.22C1346.94 1516.96 1271.87 1494.91 1228.27 1485.86C1175.11 1474.83 1135.67 1472.68 1129.62 1467.94C1126.78 1464.79 1124.41 1460.12 1121.03 1455.25C1117.66 1450.37 1113.35 1445.43 1102.31 1435.37',
    'M1777.63 659.561C1773.12 669.175 1757.08 694.721 1716 798.141C1705.67 824.122 1706.06 861.092 1710.15 923.458C1714.05 982.838 1730.02 1018.31 1736.21 1030.46C1747.37 1052.41 1797.59 1049.31 1842.13 1074.33C1866.09 1087.79 1871.46 1120.44 1875.34 1143.31C1877.02 1153.19 1875.23 1164.55 1873.83 1175.7C1872.64 1185.16 1861.1 1201.19 1832.93 1232.02C1789.77 1279.26 1755.22 1309.5 1746.93 1325.44C1725.92 1365.81 1728.07 1427.51 1730.51 1462.02C1731.25 1472.42 1741.79 1478.13 1748.59 1480.47C1755.15 1482.73 1774.97 1479.34 1800.92 1466.43C1836.31 1448.83 1824.02 1389.89 1834.88 1354.93C1849.32 1308.45 1855.99 1272 1862.98 1259.47C1881.43 1226.39 1946.31 1334.66 1966.9 1375.31C1996.98 1434.71 2012.77 1479.31 2025.32 1486.21C2033.84 1490.89 2047.85 1495.72 2059.3 1483.85C2091.13 1450.82 2091.33 1405.82 2096.25 1393.31C2104.38 1337.16 2111.77 1246.47 2103.68 1223.01C2097.41 1211.6 2085.93 1192.68 2073.11 1172.24',
    'M2065.91 511.15C2065.91 511.648 2065.91 569.323 2065.56 658.17C2065.42 693.313 2059.32 711.415 2043.2 751.484C2017.24 816.017 1987.37 868.586 1975.46 908.376C1946.6 1004.79 1957.96 1050.32 1968.75 1070.26C1979.52 1090.16 2031.1 1102.24 2092.51 1113.85C2142.58 1123.32 2182.29 1103.77 2227.9 1099.62C2253.02 1097.34 2290.51 1150.18 2314.75 1185.4C2324.84 1200.07 2326.3 1214.75 2324.9 1224.28C2323.04 1236.93 2294.45 1264.16 2257.8 1300.14C2219.62 1337.62 2181.01 1341.1 2148.91 1345.64C2119.37 1349.82 2097.23 1344 2088.38 1336.77C2065.99 1318.47 2057.7 1295.29 2028.9 1244.28C2019.5 1227.64 2017.21 1216.32 2014.55 1192.73C2008.84 1141.97 2005.91 1091.59 2006.9 1063.18C2007.46 1047.07 2031.01 1005.7 2065.45 944.767C2079.32 920.232 2087.91 909.84 2093.28 903.09C2098.64 896.34 2101.05 893.849 2092.79 887.339C2047.01 851.261 2021.18 851.84 1946.34 840.41C1885.39 831.103 1776.99 820.541 1710.98 814.454C1624.57 806.488 1595.86 810.216 1577.56 815.534C1551.44 823.125 1533.69 834.681 1526.55 839.967C1519.94 844.854 1517.12 876.498 1516.03 919.301C1515.63 934.957 1518.76 938.3 1532.7 943.061C1571.41 956.274 1601.95 960.547 1614.72 961.132C1638.72 962.232 1665.44 959.698 1704.45 957.202C1732.03 956.341 1775.38 956.301 1799.74 955.592C1824.1 954.883 1828.16 953.507 1834.39 952.022',
    'M2281.24 622.701C2278.77 626.501 2261.94 680.355 2242.04 766.959C2225.38 839.449 2234.89 894.644 2240.99 927.828C2244.95 949.397 2251.69 961.145 2257.34 968.922C2262.11 975.491 2302.12 1010.38 2362.04 1065.8C2396.46 1097.63 2406.49 1114.21 2413.01 1135.55C2440.93 1226.91 2428.25 1256.5 2411.49 1289.87C2395.59 1321.53 2339.9 1354.68 2304.03 1374.13C2288.82 1382.38 2255.23 1352.21 2238.88 1334.28C2233.69 1328.6 2235.27 1301.74 2238.64 1248.05C2243.37 1172.71 2255.32 1119.41 2255.19 1102.16C2254.85 1056.76 2231.5 998.269 2223.93 997.474C2219.74 997.034 2214.72 998.474 2172.67 1004.27C2130.62 1010.06 2051.67 1020.67 1979.12 1033.22C1906.57 1045.76 1842.82 1059.93 1785 1068.12C1727.19 1076.31 1677.23 1078.09 1625.37 1075.47C1573.5 1072.85 1521.22 1065.76 1491.96 1061.21C1457.85 1055.91 1450.09 1051.23 1442.57 1046.39C1432.23 1039.74 1389.6 998.212 1329.13 937.565C1296.37 904.715 1274.59 864.045 1249.44 819.077C1237.26 797.32 1227.65 788.902 1217.65 781.862C1202.69 775.392 1118 772.573 1057.5 768.178C1049.38 766.157 1039.63 762.978 1020.01 760.618'
  ];
  const FLOWER_FILL = ['#FF1EAC', '#FF56C1', '#FF56C1', '#FF56C1', '#FF56C1', '#FF1EAC', '#FF1EAC', '#FF9EDC', '#FF9EDC', '#FF9EDC'];
  const EYE_COLOR = ['#52DAFF', '#52DAFF', '#52DAFF', '#75AC78', '#0D6D87', '#BD9615', '#52DAFF', '#158D4D', '#52DAFF', '#A58105'];
  const EYE_R = [17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 12.9765, 12.9765, 12.9765];
  const STEM_TO_FLOWER = [2, 0, 1, 7, 5, 8, 3, 6, 4, 9];
  const ANCHOR_IDX = [0, 1, 12]; // well-separated, non-collinear master point indices

  function catmullRomToBezierPath(points) {
    if (points.length < 2) return '';
    let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function initLily(i) {
    const flowerIdx = i;
    const stemIdx = STEM_TO_FLOWER.indexOf(flowerIdx);

    const eyeGroup = document.getElementById('eyeGroup' + flowerIdx);
    const eyeWhite = document.getElementById('eyeWhite' + flowerIdx);
    const eyePupil = document.getElementById('eyePupil' + flowerIdx);
    const stemPath = document.getElementById('stemPath' + flowerIdx);
    const flowerPath = document.getElementById('flowerPath' + flowerIdx);

    flowerPath.setAttribute('fill', FLOWER_FILL[flowerIdx]);
    eyeWhite.setAttribute('fill', EYE_COLOR[flowerIdx]);
    const rScale = EYE_R[flowerIdx] / 17.5;
    eyeWhite.setAttribute('r', 17.5 * rScale);
    eyePupil.setAttribute('r', 10 * rScale);

    const STEM_COLOR_BY_FLOWER = { '#FF1EAC': '#0C9A18', '#FF56C1': '#0ACE16', '#FF9EDC': '#7CE885' };
    stemPath.setAttribute('stroke', STEM_COLOR_BY_FLOWER[FLOWER_FILL[flowerIdx]] || '#0ACE16');

    const instPairs = numsFromD(POOL_FLOWER_D[flowerIdx]);
    const mp = ANCHOR_IDX.map(k => MASTER_PAIRS_OPEN[k]);
    const ip = ANCHOR_IDX.map(k => instPairs[k]);
    const M = solveAffine(mp, ip);

    const instOpenPairs = applyAffineArr(M, MASTER_PAIRS_OPEN);
    const instClosedPairs = applyAffineArr(M, MASTER_PAIRS_CLOSED);
    const instEyeOpen = applyAffine(M, EYE_OPEN);
    const instEyeClosed = applyAffine(M, EYE_CLOSED);
    const instPupilOpen = applyAffine(M, PUPIL_OPEN);
    const instPupilClosed = applyAffine(M, PUPIL_CLOSED);
    const instFlowerCenter = applyAffine(M, FLOWER_CENTER_LOCAL);

    stemPath.setAttribute('d', POOL_STEM_D[stemIdx]);
    const SAMPLE_COUNT = 42;
    const totalLen = stemPath.getTotalLength();
    let basePoints = [];
    for (let s = 0; s < SAMPLE_COUNT; s++) {
      const len = (s / (SAMPLE_COUNT - 1)) * totalLen;
      const p = stemPath.getPointAtLength(len);
      basePoints.push({ x: p.x, y: p.y });
    }

    // The wave taper below assumes index 0 = free tail, last index = flower
    // attachment. Real pool stems aren't all drawn in the same direction, so
    // detect which end is actually nearest the flower and reverse if needed.
    const distToStart = Math.hypot(basePoints[0].x - instFlowerCenter.x, basePoints[0].y - instFlowerCenter.y);
    const distToEnd = Math.hypot(basePoints[SAMPLE_COUNT - 1].x - instFlowerCenter.x, basePoints[SAMPLE_COUNT - 1].y - instFlowerCenter.y);
    if (distToStart < distToEnd) basePoints.reverse();

    const normals = basePoints.map((p, s) => {
      const prev = basePoints[Math.max(0, s - 1)];
      const next = basePoints[Math.min(SAMPLE_COUNT - 1, s + 1)];
      const tx = next.x - prev.x, ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      return { x: -ty / len, y: tx / len };
    });

    let proximity = 0;
    let openness = 0;
    const phase = flowerIdx * 1.3;

    function update(mouse, t) {
      const dx = mouse.x - instFlowerCenter.x;
      const dy = mouse.y - instFlowerCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetProximity = mouse.active ? clamp(1 - dist / MAX_DIST, 0, 1) : 0;
      proximity += (targetProximity - proximity) * 0.08;

      const idleBreath = Math.sin(t * 0.8 + phase) * 0.03;
      // bloom follows cursor height: near the top of the screen = open,
      // near the bottom = closed. HEIGHT_SENSITIVITY steepens the response
      // around vertical center so even a small mouse move swings openness
      // from closed to open; the easing factor controls how fast the bloom
      // catches up to that target. Proximity (distance to this flower) still
      // shapes eye-follow strength and stem wiggle energy below.
      const HEIGHT_SENSITIVITY = 8;
      const heightFactor = mouse.active ? clamp(0.5 + (0.5 - (mouse.y - VIEWBOX_Y_MIN) / VIEWBOX_HEIGHT) * HEIGHT_SENSITIVITY, 0, 1) : 0.5;
      const targetOpenness = clamp(heightFactor + idleBreath, 0, 1);
      openness += (targetOpenness - openness) * 0.28;

      const flowerNow = lerpPairs(instClosedPairs, instOpenPairs, openness);
      flowerPath.setAttribute('d', buildPathFromPairs(flowerNow));

      const baseEyeX = lerp(instEyeClosed.x, instEyeOpen.x, openness);
      const baseEyeY = lerp(instEyeClosed.y, instEyeOpen.y, openness);
      const basePupilX = lerp(instPupilClosed.x, instPupilOpen.x, openness);
      const basePupilY = lerp(instPupilClosed.y, instPupilOpen.y, openness);
      eyeWhite.setAttribute('cx', baseEyeX);
      eyeWhite.setAttribute('cy', baseEyeY);
      eyePupil.setAttribute('cx', basePupilX);
      eyePupil.setAttribute('cy', basePupilY);

      const edx = mouse.x - baseEyeX;
      const edy = mouse.y - baseEyeY;
      const eAngle = Math.atan2(edy, edx);
      const eMag = mouse.active ? Math.min(EYE_TRAVEL, Math.sqrt(edx * edx + edy * edy) / 20) : 0;
      eyeGroup.style.transform = `translate(${Math.cos(eAngle) * eMag}px, ${Math.sin(eAngle) * eMag}px)`;

      const idleAmp = 4;
      const reactiveAmp = proximity * 34;
      const maxAmp = idleAmp + reactiveAmp;
      const waveSpeed = 2.6 + proximity * 3.5;
      const wavePhaseStep = 0.55;

      const displaced = basePoints.map((p, s) => {
        const taper = s / (SAMPLE_COUNT - 1); // 0 at free tail, 1 at flower attachment
        const amp = maxAmp * (1 - taper) ** 1.4;
        const offset = amp * Math.sin(t * waveSpeed - s * wavePhaseStep + phase);
        return { x: p.x + normals[s].x * offset, y: p.y + normals[s].y * offset };
      });
      stemPath.setAttribute('d', catmullRomToBezierPath(displaced));
    }

    return { update };
  }

  const lilies = [];
  for (let i = 0; i < POOL_FLOWER_D.length; i++) lilies.push(initLily(i));

  function toSvgCoords(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const scaleX = 2650 / rect.width;
    const scaleY = VIEWBOX_HEIGHT / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY + VIEWBOX_Y_MIN };
  }

  let mouse = { x: 0, y: 0, active: false, down: false };
  window.addEventListener('pointermove', (e) => { mouse = { ...mouse, ...toSvgCoords(e.clientX, e.clientY), active: true }; });
  window.addEventListener('pointerleave', () => { mouse.active = false; });
  window.addEventListener('pointerdown', () => { mouse.down = true; });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  let t = 0;
  function frame() {
    t += 0.016;
    for (const lily of lilies) lily.update(mouse, t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
