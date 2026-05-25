KEYWORD_EXTRACT_PROMPT = """你是一位书籍检索专家。从用户描述中提取 3-8 个检索关键词。

用户输入：{user_input}

要求：
- 覆盖主题领域、情绪基调、目标受众、书籍类型
- 优先中文，必要时补充英文
- 仅返回 JSON 数组，无解释

示例：["心理学", "人际关系", "非暴力沟通", "职场"]"""

BOOK_SEARCH_FORMAT_PROMPT = """你是一位书籍信息整理专家。将多源原始检索数据整理为标准格式。

原始数据：{raw_search_results}

规则：
- 去重（书名+作者相同则合并）
- 补全缺失简介
- 剔除明显不相关条目
- 按相关性降序保留 2-5 项

输出严格 JSON 数组，无其他文字：
[{{"title": "", "author": "", "intro": "100-200字简介", "relevance_reason": ""}}]"""

ENTRY_ROUTE_PROMPT = """判断用户输入属于哪种模式：
- 模式一（keyword）：用户输入的是模糊描述、关键词、或想要某类书的需求
- 模式二（direct）：用户输入了明确的书名（可能带作者名）

用户输入：{user_input}

仅返回 JSON，无其他文字：
{{"mode": "keyword" 或 "direct", "reason": "简短理由"}}"""

GENERATE_SCRIPT_PROMPT = """你是一位资深短视频口播稿撰稿人，擅长将书籍内容转化为讲故事式口播稿。

书籍信息：
书名：{book_title}
作者：{book_author}
简介：{book_intro}

参考示例（仅借鉴句式结构，如存在）：
{reference_script}

任务：撰写 8-15 分钟口播稿（约 2000-3500 字）。

核心要求：
1. 第三人称叙述
2. 讲故事式转述，有起承转合
3. 概述整本书全部章节核心内容，不局限于片段
4. 风格由你根据书籍主旨自动判定（幽默/严肃/积极/治愈/批判等）
5. 弱关联当前社会现实，自然融入，不生硬说教
6. 用 ## 章节标题 分段（每章一行二级标题，标题简短有吸引力），标题下正文为纯文本
7. 禁止编造原文不存在的情节、论点、案例

叙事建议（灵活调整，每段对应一个 ## 章节）：
- 开场钩子 → 背景铺垫 → 分章转述（可按原书章节拆多段）→ 高潮转折 → 现实映照 → 收尾升华

直接输出口播稿全文，保留 ## 章节标记，不要加其它说明。"""

REVIEW_SCRIPT_PROMPT = """你是一位严格的书籍内容审核员。审核 AI 生成的口播稿是否忠实、准确地转述了原书。

审核方法：
1. 基于你的知识回顾该书核心情节、论点、章节结构
2. 结合联网搜索补充验证（如可用）

书籍：{book_title} / {book_author}
待审核稿：{script_draft}
联网补充：{web_search_results}

评分维度（各 0-25，满分 100）：
1. 事实准确性：有无编造原文不存在的情节/论点/案例/数据
2. 忠实度：转述是否歪曲作者原意，有无断章取义
3. 完整性：是否遗漏全书核心章节关键内容
4. 风格一致性：风格是否符合该书主旨应有的基调

输出严格 JSON，无其他文字：
{{
  "fact_accuracy": 0,
  "fidelity": 0,
  "completeness": 0,
  "style_consistency": 0,
  "total": 0,
  "reasoning": "总体评价与详细理由，200-400字",
  "hallucinations": [],
  "omissions": []
}}

规则：
- 如无问题可给满分
- hallucinations/omissions 无则填 []
- 总分 = 四维之和
- 理由必须具体，指出问题所在段落"""

APPLY_FEEDBACK_PROMPT = """你是一位口播稿修改专家。根据用户反馈精准修改，仅改用户提到的问题，不擅自大改。

当前稿件：{current_script}
用户反馈：{user_feedback}

要求：
- 保持整体叙事结构和风格一致
- 必须保留 ## 章节标题 分段格式
- 反馈模糊时增加细节描写或情绪渲染
- 要求增加某章节时，在不编造前提下补充
- 要求删减时优先删重复或次要内容

输出修改后的完整稿件全文（不要只输出片段）。"""

PRESENTATION_OUTLINE_PROMPT = """你是一位短视频网页演示编导。将口播稿章节拆成可点击推进的演示步骤（每步一屏）。

书籍：{book_title} / {book_author}

口播稿章节（JSON）：
{chapters_json}

任务：输出严格 JSON 数组，无其它文字。每项为一步，字段：
- type: "hero" | "text" | "quote" | "list_item"（必填）
- chapter_title: 所属章节标题（必填）
- narration: 该步口播短句，15-60字，供配音（必填）
- title, subtitle: hero 用
- body: text 用，每步 body 不超过 120 字
- quote: quote 用
- list_title, item_index, item_text: list_item 用（列表必须拆成多个 list_item，1 项 = 1 step）

规则：
1. 按章节顺序，每章至少 2-4 步
2. 每章开头优先 hero（大标题+副标题）
3. 禁止一步塞整章全文；长列表拆成多个 list_item
4. 保留口播叙事顺序，覆盖各章核心信息
5. narration 与屏幕文字可略有不同，但必须连贯

示例一项：
{{"type":"hero","chapter_title":"开场","title":"主标题","subtitle":"副标题","narration":"你有没有想过……"}}"""
