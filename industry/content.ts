/** 本站的板块、关注视角和重点厂商；别名用于公告和中标规则预筛。 */
export const BOARDS = ["政策标准", "厂商动态", "项目中标", "标杆实践", "技术趋势", "市场资本"] as const;
export const PERSPECTIVES = ["产品技术", "市场经营"] as const;
export const DAILY_PERSPECTIVES = ["市场经营", "产品技术"] as const;
export const KEY_VENDORS = [
  { name: "卫宁健康", aliases: ["卫宁健康", "卫宁软件"], stockCode: "300253" },
  { name: "东软集团", aliases: ["东软集团", "东软"], stockCode: "600718", exclude: "东软医疗" },
  { name: "创业慧康", aliases: ["创业慧康", "创业软件"], stockCode: "300451" },
  { name: "东华软件", aliases: ["东华软件", "东华医为"], stockCode: "002065" },
  { name: "医渡科技", aliases: ["医渡科技"], stockCode: "02158" },
  { name: "讯飞医疗", aliases: ["讯飞医疗", "科大讯飞医疗"], stockCode: "02506" },
  { name: "嘉和美康", aliases: ["嘉和美康"], stockCode: "688246" },
] as const;
