/* Original fictional content. No game map, article, or player record is included. */
(function (root) {
  'use strict';
  const data = {
    schemaVersion: 1,
    title: '雾川行记',
    categories: [
      { id: 'camp', label: '营地', symbol: '⌂', color: '#247b85' },
      { id: 'treasure', label: '藏品', symbol: '◇', color: '#c18429' },
      { id: 'encounter', label: '挑战', symbol: '⚔', color: '#bb5d4b' },
      { id: 'story', label: '见闻', symbol: '✦', color: '#7770a8' }
    ],
    regions: [
      { id: 'mistvale', name: '雾川谷', subtitle: '沿溪入谷，循灯而行', image: 'assets/mistvale.svg' },
      { id: 'starshore', name: '星潮湾', subtitle: '越过群礁，抵达灯塔', image: 'assets/starshore.svg' }
    ],
    points: [
      { id: 'mv-camp', region: 'mistvale', category: 'camp', title: '渡口营地', x: 180, y: 520, summary: '沿石阶进入山谷的第一处落脚点。', guide: ['在渡口木棚整理行囊。', '向东北的石桥出发，留意河边的小路。'], note: '原创示例：营地可以作为推荐路线的起点。' },
      { id: 'mv-jade', region: 'mistvale', category: 'treasure', title: '溪畔青玉', x: 310, y: 455, summary: '浅溪转弯处，一块青玉藏在芦苇旁。', guide: ['从渡口沿河岸向东。', '在两丛芦苇之间寻找圆形石台。'], note: '原创示例：藏品勾选会同步显示在路线中。' },
      { id: 'mv-bridge', region: 'mistvale', category: 'story', title: '旧桥碑记', x: 455, y: 370, summary: '石桥边的碑文讲述了山谷的旧时往事。', guide: ['穿过石桥后停在北岸。', '阅读桥头石碑，继续沿灯柱上山。'], note: '原创示例：见闻点可连接攻略正文。' },
      { id: 'mv-warden', region: 'mistvale', category: 'encounter', title: '山门守卫', x: 590, y: 260, summary: '守卫在山门前演示一套有规律的招式。', guide: ['先观察一次完整的三段动作。', '等最后一段结束，再前进一步。', '本例只用于展示攻略步骤，不对应真实游戏机制。'], note: '难度标签与战斗提示可按你的项目扩展。' },
      { id: 'mv-lantern', region: 'mistvale', category: 'treasure', title: '遗落风灯', x: 750, y: 210, summary: '高处松林里，一盏旧灯映着雾色。', guide: ['绕过山门北侧的斜坡。', '走到两株古松之间的平台。'], note: '路径和奖励均为虚构示例。' },
      { id: 'mv-pavilion', region: 'mistvale', category: 'camp', title: '听雨亭', x: 840, y: 370, summary: '谷中高台上的小亭，可眺望整段溪流。', guide: ['从松林向东下行。', '到达亭子后，可回看尚未探索的点位。'], note: '本地进度只保存在当前浏览器。' },
      { id: 'mv-bell', region: 'mistvale', category: 'story', title: '无声古钟', x: 665, y: 490, summary: '古道尽头挂着一口不再鸣响的铜钟。', guide: ['从听雨亭向西南走。', '在古钟旁记录这段见闻。'], note: '示例详情使用纯文本，避免不可信 HTML。' },
      { id: 'mv-cave', region: 'mistvale', category: 'encounter', title: '回音石窟', x: 430, y: 590, summary: '石窟中的回音考验来访者的方向感。', guide: ['循着南岸的小径进入石窟。', '观察三处反光，依次找到出口。'], note: '没有隐藏后端、账号登录或付费内容。' },
      { id: 'ss-camp', region: 'starshore', category: 'camp', title: '潮汐驿站', x: 190, y: 450, summary: '海湾的起点，岸边停泊着小舟。', guide: ['从驿站走到海边。', '沿栈道前往观潮台。'], note: '第二张地图演示分区切换。' },
      { id: 'ss-shell', region: 'starshore', category: 'treasure', title: '银纹海螺', x: 335, y: 540, summary: '浅滩的石缝里，一枚海螺泛着银光。', guide: ['从驿站向东南走到浅滩。', '在潮水线外侧查看三块小石头。'], note: '点位位置可在 data.js 中修改。' },
      { id: 'ss-lookout', region: 'starshore', category: 'story', title: '观潮台', x: 450, y: 390, summary: '木台面对大海，记录着潮水变化。', guide: ['沿栈道上到木台。', '读完见闻后，往北侧群礁出发。'], note: '可用搜索按标题或说明查找。' },
      { id: 'ss-reef', region: 'starshore', category: 'encounter', title: '群礁试炼', x: 590, y: 275, summary: '在起伏的礁石间，试着找到平稳的落脚点。', guide: ['先观察礁石的高低。', '沿较浅的三处平台前进。'], note: '路线连接只表示顺序，不提供自动寻路。' },
      { id: 'ss-lighthouse', region: 'starshore', category: 'camp', title: '北岬灯塔', x: 790, y: 180, summary: '海湾尽头的灯塔，是这段旅途的终点。', guide: ['从群礁向东北走上石阶。', '在灯塔前回看旅途进度。'], note: '可以导出 JSON 备份自己的演示进度。' },
      { id: 'ss-compass', region: 'starshore', category: 'treasure', title: '旧铜罗盘', x: 735, y: 440, summary: '漂流木旁，一只罗盘指向旧港的方向。', guide: ['从观潮台向东，绕过海湾。', '在漂流木的内侧寻找圆形铜盒。'], note: '导入文件会先校验，再请求确认替换。' },
      { id: 'ss-arch', region: 'starshore', category: 'story', title: '海蚀石门', x: 900, y: 520, summary: '自然形成的石门留下海风的痕迹。', guide: ['沿东侧沙滩缓慢前行。', '从石门下回望灯塔。'], note: '原创地名与文案，不是官方攻略。' },
      { id: 'ss-island', region: 'starshore', category: 'encounter', title: '孤屿回响', x: 935, y: 300, summary: '离岸小岛上，风声仿佛回应着来客。', guide: ['本点是支线交互示例。', '真实地图应以已获许可的实测数据替换。'], note: '不应将虚构示例混入真实游戏攻略。' }
    ],
    routes: [
      { id: 'valley-walk', region: 'mistvale', title: '初访雾川', description: '由渡口上行，经过石桥与山门，终点是听雨亭。', points: ['mv-camp', 'mv-jade', 'mv-bridge', 'mv-warden', 'mv-lantern', 'mv-pavilion'] },
      { id: 'shore-walk', region: 'starshore', title: '逐潮之路', description: '从海边驿站出发，越过群礁，前往北岬灯塔。', points: ['ss-camp', 'ss-shell', 'ss-lookout', 'ss-reef', 'ss-lighthouse'] }
    ]
  };
  root.MapData = data;
  if (typeof module !== 'undefined') module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
