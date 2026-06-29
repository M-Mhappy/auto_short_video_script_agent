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

SCRIPT_CONTEXT_PREFIX_PROMPT = """书籍信息：
书名：{book_title}
作者：{book_author}
简介：{book_intro}

参考示例（仅借鉴句式结构，如存在；不要复述示例内容）：
{reference_script}

通用口播稿约束：
1. 第三人称叙述
2. 讲故事式转述，有起承转合
3. 概述整本书全部章节核心内容，不局限于片段
4. 风格由你根据书籍主旨自动判定（幽默/严肃/积极/治愈/批判等）
5. 弱关联当前社会现实，自然融入，不生硬说教
6. 用 ## 章节标题 分段（每章一行二级标题，标题简短有吸引力），标题下正文为纯文本
7. 禁止编造原文不存在的情节、论点、案例

叙事建议（灵活调整，每段对应一个 ## 章节）：
- 开场钩子 → 背景铺垫 → 分章转述（可按原书章节拆多段）→ 高潮转折 → 现实映照 → 收尾升华"""

GENERATE_SCRIPT_TASK_PROMPT = """任务：基于以上书籍信息与参考示例，撰写 8-15 分钟口播稿（约 2000-3500 字）。

直接输出口播稿全文，保留 ## 章节标记，不要加其它说明。"""

GENERATE_SCRIPT_PROMPT = """书籍信息：
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

REVIEW_SCRIPT_PROMPT = """书籍：{book_title} / {book_author}

联网补充：{web_search_results}

待审核稿：
{script_draft}

评分维度（各 0-25，满分 100）：
1. 事实准确性：有无编造原文不存在的情节/论点/案例/数据
2. 忠实度：转述是否歪曲作者原意，有无断章取义
3. 完整性：是否遗漏全书核心章节关键内容
4. 风格一致性：风格是否符合该书主旨应有的基调

输出严格 JSON，无其他文字：
{{"fact_accuracy": 0, "fidelity": 0, "completeness": 0, "style_consistency": 0, "total": 0, "reasoning": "总体评价与详细理由，200-400字", "hallucinations": [], "omissions": []}}

规则：
- 如无问题可给满分
- hallucinations/omissions 无则填 []
- 总分 = 四维之和
- 理由必须具体，指出问题所在段落"""

APPLY_FEEDBACK_TASK_PROMPT = """任务：基于以上书籍信息、参考示例和通用约束，修改当前口播稿。

当前稿件：
{current_script}

用户修改要求：
{user_feedback}

要求：
1. 针对用户提到的问题做出明确、可感知的修改
2. 修改后的稿件必须与原稿有显著不同
3. 保持整体叙事结构和风格一致
4. 必须保留 ## 章节标题 分段格式
5. 反馈要求增加内容时，在不编造前提下补充
6. 反馈要求删减时优先删重复或次要内容
7. 输出修改后的完整稿件全文"""

APPLY_FEEDBACK_PROMPT = """当前稿件：
{current_script}

用户修改要求：
{user_feedback}

要求：
1. 针对用户提到的问题做出明确、可感知的修改
2. 修改后的稿件必须与原稿有显著不同
3. 保持整体叙事结构和风格一致
4. 必须保留 ## 章节标题 分段格式
5. 反馈要求增加内容时，在不编造前提下补充
6. 反馈要求删减时优先删重复或次要内容
7. 输出修改后的完整稿件全文"""

PRESENTATION_OUTLINE_PROMPT = """你是一位书籍纪录片视觉导演。将口播稿章节拆分为演示步骤（每步一屏），要求画面如书籍纪录片般有叙事感和氛围。

书籍：{book_title} / {book_author}

口播稿章节（JSON）：
{chapters_json}

任务：输出严格 JSON 数组，无其它文字。每项为一步，字段如下：

```
{{
  "step": 序号(从1开始),
  "chapter_title": "所属章节标题（必填）",
  "narration": "该步口播短句，15-60字，供配音（必填）",
  "screen": {{
    "headline": "核心标题，简短有力，6-15字（必填）",
    "subhead": "副标题/补充信息（可选，空字符串表示无）",
    "visual": {{
      "type": "reveal | quote | list",
      "elements": [
        {{
          "kind": "text | number | quote | icon",
          "content": "元素内容",
          "role": "该元素在画面中的功能角色",
          "animate": "fade-in | fly-in | typewriter | none"
        }}
      ],
      "mood": "calm | tense | dramatic | playful | warm | mysterious",
      "scene": "book | archive | timeline | silhouette | city | nature | void",
      "motion": "slow | medium | strong"
    }}
  }}
}}
```

## 视觉类型说明

| type | 何时用 | elements 要求 |
|------|--------|---------------|
| reveal | 展示核心观点/标题/场景描述 | 1-3 个短元素，混用 text/number/icon 丰富画面 |
| quote | 引用书中金句/原话 | 1 个 kind="quote" 元素 + 可选 subhead 填出处 |
| list | 逐项揭示要点 | 每步 1-2 个元素，可用 number 带数字编号 |

## element kind 选用指南

| kind | 何时用 | content 写法 | 示例 |
|------|--------|-------------|------|
| text | 短关键词/短语/场景描述（**控制在20字以内**） | 精炼短句 | "命运的十字路口" |
| number | 涉及数字/排名/阶段/天数/年份 | "数字+说明"（如"7天"、"3个阶段"） | "7天 亡者的漫游" |
| icon | 场景关键词，表示氛围/象征（不再用 emoji，写关键词即可） | 概念词 | "孤独" |
| quote | 书中原话/金句 | 金句全文 | "活着就是为了活着本身" |

## scene 场景选用（纪录片风格场景动画）

| scene | 何时用 | 画面效果 |
|-------|--------|----------|
| book | 阅读、翻阅、文字相关、开篇/收尾 | 翻页、书脊、纸上文字行 |
| archive | 档案、历史回顾、资料考证 | 档案卡片、批注线、印章 |
| timeline | 时间推进、阶段递进、人生节点 | 时间轴、节点点亮 |
| silhouette | 人物描写、孤独、行走、内心 | 人物剪影、行走/停顿 |
| city | 城市、社会、现实映照 | 远景楼群、窗口灯光 |
| nature | 自然、田园、季节、环境 | 树影、雨线、叶片飘落 |
| void | 死亡、虚无、哲思、迷失 | 雾气、漂浮纸屑 |

## motion 动画节奏

| motion | 何时用 |
|--------|--------|
| slow | 安静叙述、哲思、回忆 |
| medium | 一般叙事（默认） |
| strong | 高潮、冲突、转折 |

## mood 选用

| mood | 何时用 |
|------|--------|
| dramatic | 开场钩子、高潮、冲突、震撼观点 |
| warm | 治愈、温情、亲情、爱情 |
| tense | 紧张、悬疑、危机 |
| mysterious | 神秘、哲思、未知 |
| playful | 幽默、讽刺、轻松 |
| calm | 叙述、过渡、总结 |

## animate 选用

| animate | 何时用 |
|---------|--------|
| fade-in | 默认，适合大多数元素 |
| fly-in | list 条目、从侧面滑入的要点 |
| typewriter | 悬念揭示、关键短语逐字出现 |
| none | 已在前一步显示过的固定标题 |

## 约束

1. 按章节顺序，每章 2-5 步
2. 每章开头用 reveal + dramatic/warm mood 展示章节标题
3. **每步聚焦一个想法**，禁止一步塞整章全文
4. headline 必须简短有力（6-15字），**不要把整段话塞进 headline**
5. text 类 content **控制在 20 字以内**，是关键词/短句而非段落
6. **积极使用 number 和 icon**，让画面有视觉层次，不要全部都是 text
7. 每步 mood 要根据内容氛围变化，不要全填 calm
8. **每步必须填写 scene 和 motion**，根据内容选择最贴切的纪录片场景
9. scene 应随内容变化，同一章可切换不同场景
10. narration 与屏幕文字可略有不同，但必须连贯
11. 保留口播叙事顺序，覆盖各章核心信息
12. 禁止编造书中没有的数据/案例

示例三项：
[{{"step":1,"chapter_title":"开场","narration":"你有没有想过，如果人死后还有意识，会最先想到什么？","screen":{{"headline":"死后的意识","subhead":"","visual":{{"type":"reveal","elements":[{{"kind":"icon","content":"死亡","role":"氛围关键词","animate":"fade-in"}},{{"kind":"text","content":"如果你还有意识","role":"核心问题","animate":"typewriter"}}],"mood":"dramatic","scene":"void","motion":"medium"}}}}}},{{"step":2,"chapter_title":"七天漫游","narration":"主人公用了整整七天，走遍了死后的世界。","screen":{{"headline":"七天漫游","subhead":"亡者眼中的人间","visual":{{"type":"reveal","elements":[{{"kind":"number","content":"7天 亡者的漫游","role":"时间跨度","animate":"fade-in"}},{{"kind":"icon","content":"旅行","role":"叙事线索","animate":"fade-in"}}],"mood":"mysterious","scene":"timeline","motion":"slow"}}}}}},{{"step":3,"chapter_title":"金句","narration":"余华写道：死无葬身之地，是最温暖的归宿。","screen":{{"headline":"","subhead":"——余华《第七天》","visual":{{"type":"quote","elements":[{{"kind":"quote","content":"死无葬身之地，是最温暖的归宿","role":"金句","animate":"fade-in"}}],"mood":"warm","scene":"book","motion":"slow"}}}}}}]"""
